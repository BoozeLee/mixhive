import { NextRequest, NextResponse } from 'next/server'
import { Server } from 'socket.io'
import { createServer } from 'http'

// In-memory storage for active connections (in production, use Redis)
const activeConnections = new Map<string, Set<string>>() // userId -> Set of socket IDs
const userSockets = new Map<string, string>() // socketId -> userId

class WebSocketServer {
  private io: Server
  private httpServer: any

  constructor() {
    this.httpServer = createServer()
    this.io = new Server(this.httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production' ? false : ["http://localhost:5173"],
        methods: ["GET", "POST"]
      },
      transports: ['websocket'],
      allowEIO3: true
    })

    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`)

      // Handle user authentication
      socket.on('authenticate', (data) => {
        const { userId, token } = data
        
        // Validate token (in production, verify with JWT)
        if (this.validateToken(token)) {
          userSockets.set(socket.id, userId)
          
          // Add user to connections map
          if (!activeConnections.has(userId)) {
            activeConnections.set(userId, new Set())
          }
          activeConnections.get(userId)!.add(socket.id)
          
          socket.emit('authenticated', { success: true })
          console.log(`User ${userId} authenticated`)
        } else {
          socket.emit('authenticated', { success: false })
          socket.disconnect()
        }
      })

      // Handle feed subscriptions
      socket.on('subscribe:feed', (data) => {
        const userId = userSockets.get(socket.id)
        if (userId) {
          socket.join(`feed:${userId}`)
          socket.join(`user:${userId}`)
          console.log(`User ${userId} subscribed to feed`)
        }
      })

      // Handle mix comment subscriptions
      socket.on('subscribe:mix:comments', (data) => {
        const { mixId } = data
        const userId = userSockets.get(socket.id)
        if (userId) {
          socket.join(`mix:${mixId}:comments`)
          console.log(`User ${userId} subscribed to mix ${mixId} comments`)
        }
      })

      // Handle notification subscriptions
      socket.on('subscribe:notifications', (data) => {
        const userId = userSockets.get(socket.id)
        if (userId) {
          socket.join(`notifications:${userId}`)
          console.log(`User ${userId} subscribed to notifications`)
        }
      })

      // Handle real-time events
      socket.on('event:like', (data) => {
        this.broadcastLikeEvent(data)
      })

      socket.on('event:comment', (data) => {
        this.broadcastCommentEvent(data)
      })

      socket.on('event:mix:upload', (data) => {
        this.broadcastMixUploadEvent(data)
      })

      socket.on('disconnect', () => {
        const userId = userSockets.get(socket.id)
        if (userId) {
          // Remove from connections
          const userSocketIds = activeConnections.get(userId)
          if (userSocketIds) {
            userSocketIds.delete(socket.id)
            if (userSocketIds.size === 0) {
              activeConnections.delete(userId)
            }
          }
          userSockets.delete(socket.id)
          console.log(`User ${userId} disconnected`)
        }
        console.log(`Socket disconnected: ${socket.id}`)
      })
    })
  }

  private validateToken(token: string): boolean {
    // In production, validate JWT with proper secret
    // For now, just check if it exists
    return token && token.length > 0
  }

  private broadcastLikeEvent(data: any) {
    const { mixId, userId } = data
    
    // Broadcast to mix subscribers
    this.io.to(`mix:${mixId}`).emit('event:like', data)
    
    // Broadcast to user's followers
    this.io.to(`user:${userId}`).emit('event:like', data)
    
    console.log(`Broadcast like event for mix ${mixId}`)
  }

  private broadcastCommentEvent(data: any) {
    const { mixId, comment } = data
    
    // Broadcast to mix comment subscribers
    this.io.to(`mix:${mixId}:comments`).emit('event:comment', data)
    
    // Notify mix author
    this.io.to(`user:${comment.dj_id}`).emit('event:notification', {
      type: 'comment',
      payload: data
    })
    
    console.log(`Broadcast comment event for mix ${mixId}`)
  }

  private broadcastMixUploadEvent(data: any) {
    const { mix } = data
    
    // Broadcast to user's followers
    this.io.to(`user:${mix.dj_id}`).emit('event:mix:upload', data)
    
    // Broadcast to general feed
    this.io.emit('feed:global', data)
    
    console.log(`Broadcast mix upload event for mix ${mix.id}`)
  }

  // Methods to trigger events from API calls
  public async triggerMixUpload(mixData: any) {
    this.broadcastMixUploadEvent({ mix: mixData })
  }

  public async triggerComment(commentData: any) {
    this.broadcastCommentEvent({ mixId: commentData.mix_id, comment: commentData })
  }

  public async triggerLike(likeData: any) {
    this.broadcastLikeEvent({
      mixId: likeData.mix_id,
      userId: likeData.user_id,
      timestamp: new Date().toISOString()
    })
  }

  public async triggerNotification(notificationData: any, userId: string) {
    this.io.to(`notifications:${userId}`).emit('event:notification', {
      type: 'notification',
      payload: notificationData,
      timestamp: new Date().toISOString()
    })
  }

  public start(port: number = 3001) {
    this.httpServer.listen(port, () => {
      console.log(`WebSocket server running on port ${port}`)
    })
  }

  public getIo() {
    return this.io
  }
}

// Initialize WebSocket server
const wsServer = new WebSocketServer()

// Start the server if this file is run directly
if (require.main === module) {
  wsServer.start()
}

export default wsServer

// API route handlers
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'WebSocket server is running',
    status: 'ok',
    connections: wsServer.getIo().engine.clientsCount
  })
}

// Health check endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    switch (body.type) {
      case 'mix:upload':
        await wsServer.triggerMixUpload(body.data)
        break
      case 'comment':
        await wsServer.triggerComment(body.data)
        break
      case 'like':
        await wsServer.triggerLike(body.data)
        break
      case 'notification':
        await wsServer.triggerNotification(body.data, body.userId)
        break
      default:
        return NextResponse.json({ error: 'Unknown event type' }, { status: 400 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('WebSocket event error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}