export type NotificationEventType =
  | 'new_follower'
  | 'mix_liked'
  | 'comment'
  | 'reply'
  | 'mix_upload'
  | 'mention'
  | 'buzz_like'
  | 'repost';

export interface NewFollowerPayload {
  actorName: string;
  actorAvatar: string;
}

export interface MixLikedPayload {
  actorName: string;
  mixTitle: string;
  mixId: string;
}

export interface CommentPayload {
  actorName: string;
  mixTitle: string;
  mixId: string;
  commentId: string;
}

export interface ReplyPayload {
  actorName: string;
  parentCommentAuthorName: string;
  mixTitle: string;
  mixId: string;
  commentId: string;
  parentCommentId: string;
}

export interface MixUploadPayload {
  actorName: string;
  mixTitle: string;
  mixId: string;
}

export interface MentionPayload {
  actorName: string;
  mixTitle: string;
  mixId: string;
  commentId: string;
}

export interface BuzzLikePayload {
  actorName: string;
  buzzAuthorName: string;
  buzzId: string;
}

export interface RepostPayload {
  actorName: string;
  originalAuthorName: string;
  buzzId: string;
}

export type NotificationEventPayload =
  | NewFollowerPayload
  | MixLikedPayload
  | CommentPayload
  | ReplyPayload
  | MixUploadPayload
  | MentionPayload
  | BuzzLikePayload
  | RepostPayload;

export type NotificationEvent = {
  id: string;
  type: NotificationEventType;
  createdAt: string;
  read: boolean;
  actorId: string;
  mixId?: string;
  buzzId?: string;
  payload: NotificationEventPayload;
};
