export async function generateWaveform(file: File, sampleCount = 500): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer()
  const ctx = new AudioContext()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  await ctx.close()

  const channelData = audioBuffer.getChannelData(0)
  const blockSize = Math.max(1, Math.floor(channelData.length / sampleCount))
  const waveform = new Float32Array(sampleCount)

  for (let i = 0; i < sampleCount; i++) {
    let sum = 0
    const start = i * blockSize
    const end = Math.min(start + blockSize, channelData.length)
    for (let j = start; j < end; j++) {
      sum += Math.abs(channelData[j])
    }
    waveform[i] = sum / (end - start)
  }

  const max = Math.max(...waveform, 0.001)
  for (let i = 0; i < sampleCount; i++) {
    waveform[i] /= max
  }

  return waveform
}

export function waveformToJson(waveform: Float32Array): string {
  return JSON.stringify(Array.from(waveform))
}
