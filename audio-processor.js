class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRate = 16000; // Target sample rate
    this.buffer = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      const bufferLength = channelData.length;

      // Downsample to 16 kHz if necessary
      const downsampledData = this.downsampleBuffer(
        channelData,
        this.sampleRate
      );

      // Convert Float32Array to Int16Array
      const int16Array = new Int16Array(downsampledData.length);
      for (let i = 0; i < downsampledData.length; i++) {
        int16Array[i] = Math.max(-1, Math.min(1, downsampledData[i])) * 0x7fff;
      }

      // Send the Int16Array to the main thread
      this.port.postMessage(int16Array);
    }
    return true;
  }

  downsampleBuffer(buffer, targetSampleRate) {
    if (targetSampleRate === sampleRate) {
      return buffer;
    }
    const sampleRateRatio = sampleRate / targetSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0,
        count = 0;
      for (
        let i = offsetBuffer;
        i < nextOffsetBuffer && i < buffer.length;
        i++
      ) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = accum / count;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }
}

registerProcessor("audio-processor", AudioProcessor);
