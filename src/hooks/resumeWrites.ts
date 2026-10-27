/**
 * Resends the writes a closed app left in the outbox (see writeQueue). It
 * imports every module that defines writes, so their handlers are
 * registered before the outbox is read.
 */
import { useEffect } from 'react';

import '@/hooks/appointmentWrites';
import '@/hooks/customerWrites';
import { resumeWrites } from '@/hooks/writeQueue';

/** Called once in the root layout. */
export function useResumeWrites(): void {
  useEffect(() => {
    resumeWrites();
  }, []);
}
