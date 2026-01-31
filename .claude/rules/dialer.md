# Dialer Business Logic Rules

## Campaign States
```
paused     -> active (start)
active     -> paused (pause)
active     -> completed (all leads done)
completed  -> archived (manual)
```

## Lead States
```
new        -> dialing (picked for dial)
dialing    -> contacted | no_answer | busy | failed
contacted  -> completed | callback
callback   -> dialing (when callback time reached)
*any*      -> dnc (marked as DNC)
```

## Dialing Logic

### Lead Selection Priority
1. Callbacks due (scheduledAt <= now)
2. High priority leads (priority > 0)
3. Regular leads (FIFO within list priority)

### Lead Filtering
- Skip leads with status = 'completed' | 'dnc'
- Skip leads with dialAttempts >= campaign.maxAttemptsPerLead
- Skip leads with nextDialAt > now (retry waiting)
- Apply timezone rules (lead.timezone + campaign.schedule)

### Dial Pacing (Predictive Mode)
```typescript
// Calculate calls to dial per interval
const pace = availableAgents * callsPerAgentRatio * answerRate;

// Adjust based on abandon rate
if (currentAbandonRate > maxAbandonRate) {
  pace = pace * 0.8; // Slow down
} else if (currentAbandonRate < maxAbandonRate * 0.5) {
  pace = pace * 1.1; // Speed up
}
```

## Disposition Handling

### Retry Logic
```typescript
if (disposition.retryAfterMinutes) {
  lead.nextDialAt = now + disposition.retryAfterMinutes * 60000;
  lead.status = 'new'; // Ready for retry
}
```

### DNC Logic
```typescript
if (disposition.markAsDnc) {
  lead.status = 'dnc';
  // Optionally add to DNC table
}
```

### Callback Logic
```typescript
if (disposition.scheduleCallback) {
  // Create Callback record
  // Update lead.status = 'callback'
}
```

## Call Integration

### Initiate Call
```typescript
// Use existing AgentsService.dialOutbound
const result = await agentsService.dialOutbound(campaign.aiAgentId, {
  toNumber: lead.phoneNumber,
  fromNumber: campaign.defaultCallerId,
  trunkId: campaign.outboundTrunkId,
  metadata: {
    campaignId: campaign.id,
    leadId: lead.id,
    attemptNumber: lead.dialAttempts + 1,
  },
});
```

### Handle Call Result
```typescript
// Listen for webhook events
// Update lead.dialAttempts++
// Update lead.lastDialedAt = now
// Apply disposition if available
```

## Real-time Events
```typescript
// Broadcast via CallUpdatesGateway
gateway.broadcastCampaignEvent({
  type: 'campaign_stats',
  campaignId,
  stats: {
    activeLeads,
    callsInProgress,
    completedToday,
    abandonRate,
  },
});
```
