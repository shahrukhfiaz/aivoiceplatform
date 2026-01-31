# Frontend Development Rules (Next.js/React)

## Page Structure
```
app/(protected)/page-name/
  page.tsx                 # Main page component
  [id]/
    page.tsx               # Detail page
```

## Component Patterns
```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

export default function SomePage() {
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/endpoint?page=${page}&limit=20`);
      setData(res.data);
      setTotal(res.total);
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Content */}
    </div>
  );
}
```

## API Calls
```typescript
import { apiFetch } from '@/lib/api';

// GET
const data = await apiFetch('/endpoint');

// POST
const created = await apiFetch('/endpoint', {
  method: 'POST',
  body: JSON.stringify(payload),
});

// PUT
await apiFetch(`/endpoint/${id}`, {
  method: 'PUT',
  body: JSON.stringify(payload),
});

// DELETE
await apiFetch(`/endpoint/${id}`, { method: 'DELETE' });
```

## Form Handling (React Hook Form + Zod)
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const form = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: { name: '', description: '' },
});
```

## UI Components (shadcn/ui)
```typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
```

## Real-time Updates
```typescript
import { useCallUpdates } from '@/hooks/use-call-updates';

useCallUpdates((event) => {
  if (event.type === 'campaign_updated') {
    fetchData(); // Refresh data
  }
});
```

## Sidebar Navigation
Update `components/layout/app-shell.tsx` to add new nav items.
