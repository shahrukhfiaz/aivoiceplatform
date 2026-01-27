'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

export interface TranscriptMessage {
  id: string;
  timestamp: string;
  role: 'user' | 'agent';
  text: string;
}

interface TranscriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callId: string | null;
  callUuid: string | null;
  dictionary: {
    title: string;
    user: string;
    agent: string;
    empty: string;
  };
}

export function TranscriptDialog({
  open,
  onOpenChange,
  callId,
  callUuid,
  dictionary,
}: TranscriptDialogProps) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchTranscript = useCallback(async () => {
    if (!callId) return;
    setLoading(true);
    try {
      const data = await apiFetch<TranscriptMessage[]>(
        `/webhooks/calls/${callId}/transcript`,
      );
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch transcript:', err);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    if (open && callId) {
      void fetchTranscript();
    }
  }, [open, callId, fetchTranscript]);

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {dictionary.title}
          </DialogTitle>
          {callUuid && (
            <DialogDescription className="font-mono text-xs">
              {callUuid}
            </DialogDescription>
          )}
        </DialogHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto min-h-[300px] max-h-[60vh] pr-2"
        >
          {loading ? (
            <div className="space-y-4 py-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex flex-col gap-1',
                    idx % 2 === 0 ? 'items-start' : 'items-end',
                  )}
                >
                  <Skeleton
                    className={cn(
                      'h-16 rounded-2xl',
                      idx % 2 === 0 ? 'w-3/4' : 'w-2/3',
                    )}
                  />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">{dictionary.empty}</p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex flex-col max-w-[80%] gap-1',
                    message.role === 'user' ? 'mr-auto' : 'ml-auto items-end',
                  )}
                >
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-3 text-sm',
                      message.role === 'user'
                        ? 'bg-muted text-foreground rounded-bl-sm'
                        : 'bg-primary text-primary-foreground rounded-br-sm',
                    )}
                  >
                    {message.text}
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <span
                      className={cn(
                        'text-xs font-medium',
                        message.role === 'user'
                          ? 'text-muted-foreground'
                          : 'text-primary/70',
                      )}
                    >
                      {message.role === 'user' ? dictionary.user : dictionary.agent}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
