---
title: Audio Codec Support
description: 
published: true
date: 2025-09-13T11:38:48.577Z
tags: 
editor: markdown
dateCreated: 2025-09-13T11:28:04.181Z
---

# Audio Codec Support

DSAI Core provides comprehensive support for multiple audio codecs commonly used in VoIP telephony systems. The system automatically detects and handles different codec formats to ensure seamless integration with various PBX systems and telephony infrastructure.

## Supported Audio Codecs

### μ-law (ulaw)
- **Standard**: ITU-T G.711 μ-law
- **Usage**: Primary telephony codec in North America and Japan
- **Bit Rate**: 64 kbps
- **Sample Rate**: 8 kHz
- **Compression**: Logarithmic compression algorithm

### A-law (alaw)
- **Standard**: ITU-T G.711 A-law
- **Usage**: Primary telephony codec in Europe and most international systems
- **Bit Rate**: 64 kbps
- **Sample Rate**: 8 kHz
- **Compression**: Logarithmic compression algorithm

### Linear PCM (slin)
- **Standard**: Uncompressed audio format
- **Usage**: High-quality audio transmission, often used in modern VoIP systems
- **Bit Rate**: 128 kbps (16-bit) or 64 kbps (8-bit)
- **Sample Rate**: 8 kHz (standard telephony)
- **Compression**: None (uncompressed)

## Automatic Codec Detection

DSAI Core implements intelligent codec detection that automatically identifies the incoming audio format without requiring manual configuration.

### Detection Algorithm

The system uses a statistical analysis approach to determine the codec:

1. **Audio Sample Analysis**: Incoming audio packets are analyzed for characteristic patterns
2. **RMS Calculation**: Root Mean Square values are calculated for both μ-law and A-law decoded samples
3. **Comparison Logic**: The codec with higher RMS value is selected as the detected format
4. **Logging**: The detected codec is logged for monitoring and debugging purposes

## Audio Processing Pipeline

### Incoming Audio Processing

1. **Packet Reception**: Audio packets are received from Asterisk via AudioSocket
2. **Codec Detection**: Automatic detection occurs on the first few audio packets
3. **Decoding**: Audio is decoded from the detected codec to linear PCM
4. **Processing**: All internal processing uses 8kHz, 16-bit PCM format
5. **Forwarding**: Processed audio is sent to ASR or STS services

### Outgoing Audio Processing

1. **Audio Generation**: TTS or STS services generate audio in PCM format
2. **Chunk Normalization**: Audio is normalized into 320-byte chunks
3. **Encoding**: Audio is encoded back to the appropriate codec format
4. **Transmission**: Encoded audio is sent back to Asterisk

## Technical Specifications

### Internal Audio Format
- **Sample Rate**: 8 kHz
- **Bit Depth**: 16-bit
- **Channels**: Mono
- **Format**: Linear PCM
- **Chunk Size**: 320 bytes (20ms at 8kHz)

### Codec Conversion

#### μ-law to PCM
```javascript
case 'ulaw':
    audioData = alawmulaw.mulaw.decode(audioData);
    break;
```

#### A-law to PCM
```javascript
case 'alaw':
    audioData = alawmulaw.alaw.decode(audioData);
    break;
```

## Configuration

### Environment Variables

No specific configuration is required for codec support as it's handled automatically. However, you can monitor codec detection through the logs:

```
Audio codec detected: ALAW
or
Audio codec detected: ULAW
or
Audio codec detected: SLIN
```

## Asterisk Configuration

Correct Asterisk configuration is essential to ensure that DSAI receives audio in a format it supports.  
By default, **DSAI Core expects audio in signed linear PCM (slin16, 8kHz, 16-bit mono)**.  
If Asterisk negotiates a codec that DSAI does not support (for example, Opus), DSAI will drop the call or log `No audio received / unsupported format`.

### Dialplan Configuration

There are two primary ways to connect to DSAI in your dialplan:

#### Using `AudioSocket()`
```asterisk
[demo]
exten => 5001,1,Answer()
 same => n,Ringing()
 same => n,Wait(1)
 same => n,Set(UUID=${SHELL(uuidgen | tr -d '\n')})
 same => n,AudioSocket(${UUID},127.0.0.1:5001)
 same => n,Hangup()
```

- **Pros**: Asterisk automatically transcodes the inbound audio into slin16, ensuring DSAI compatibility.
- **Cons**: Slightly higher CPU usage due to transcoding.

#### Using Dial(AudioSocket/)

```asterisk
[demo]
exten => 5001,1,Answer()
 same => n,Ringing()
 same => n,Wait(1)
 same => n,Set(UUID=${SHELL(uuidgen | tr -d '\n')})
 same => n,Dial(AudioSocket/127.0.0.1:5001/${UUID})
 same => n,Hangup()
```

- **Pros**: More scalable for large deployments (no local transcoding).
- **Cons**: DSAI receives the native codec negotiated by the endpoint (e.g., Opus, A-law, μ-law). If the codec is not supported, DSAI will immediately disconnect.

### Choosing the Right Codec

To avoid negotiation issues, configure your SIP endpoints in pjsip.conf to only allow codecs supported by DSAI:

**For A-law (Europe / International)**

```conf
[endpoint-template](!)
type=endpoint
disallow=all
allow=alaw
...
````

**For μ-law (North America / Japan)**

```conf
[endpoint-template](!)
type=endpoint
disallow=all
allow=ulaw
...
```

**For Linear PCM (best quality, higher bandwidth)**

```conf
[endpoint-template](!)
type=endpoint
disallow=all
allow=slin16
```

This ensures that even when using Dial(AudioSocket/), DSAI receives audio in a supported format.

### Debugging Codec Issues

You can check which codecs are being used with:

```bash
asterisk -rx "core show channel AudioSocket/127.0.0.1:5001-XXXX"
```

Example output:

```console
State: Up
NativeFormats: (opus)
WriteFormat: opus
ReadFormat: slin
WriteTranscode: No
ReadTranscode: No
```

In this case, the endpoint negotiated Opus, but DSAI requires slin16.
**Result**: DSAI disconnects immediately with zero billsec.

If instead you see:

```console
ReadFormat: slin
```

then DSAI will work correctly.

### Best Practice
- For testing and small setups → Use AudioSocket(). Asterisk handles transcoding automatically.
- For production deployments → Use Dial(AudioSocket/) but restrict endpoint codecs (alaw, ulaw, or slin16) to avoid negotiation problems.
- Always monitor logs: DSAI will log the detected codec (Audio codec detected: ALAW/ULAW/SLIN) during the first packets of a call.

## Performance Considerations

### CPU Usage
- **Linear PCM**: Lowest CPU usage (no conversion)
- **A-law/μ-law**: Moderate CPU usage (decoding required)
- **Mixed Codecs**: Higher CPU usage (frequent conversions)

### Memory Usage
- **Buffer Size**: 320 bytes per audio chunk
- **Queue Management**: Automatic chunk normalization
- **Garbage Collection**: Efficient buffer management

### Network Bandwidth
- **μ-law/A-law**: 64 kbps per call
- **Linear PCM**: 128 kbps per call
- **Compression**: Built-in codec compression reduces bandwidth

## Best Practices

1. **Consistent Codec Usage**: Use the same codec throughout the call session
2. **Quality vs. Bandwidth**: Balance audio quality with network resources
3. **Monitoring**: Regularly check codec detection logs
4. **Testing**: Test with different codec configurations
5. **Fallback**: Configure multiple codec options for compatibility

## Future Enhancements

Planned improvements for audio codec support:

- **Additional Codecs**: Support for G.722, G.729, and other modern codecs
- **Adaptive Quality**: Dynamic codec selection based on network conditions
- **Enhanced Detection**: Machine learning-based codec detection
- **Performance Optimization**: Hardware-accelerated codec conversion

