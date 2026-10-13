import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ticketsService } from './index';
import { supabase } from '@/lib/supabase';

vi.mock('./public', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./public')>();
  return {
    ...actual,
    loadProfile: vi.fn().mockResolvedValue({
      user: {
        id: 'usr-admin-1',
        email: 'admin@northforge.com',
        name: 'Support Admin',
        role: 'admin',
        clientId: null,
      },
      client: null,
      role: 'admin',
    }),
  };
});

describe('Requirement R5: Admin-to-Client Messaging & Ticket Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockTicketRow = {
    id: 'tc_123456789abc',
    client_id: 'cl_1',
    subject: 'Issue with booking calendar',
    status: 'open',
    priority: 'high',
    category: 'technical',
    messages: [
      {
        id: 'msg-001',
        author: 'Interior Studio',
        authorRole: 'client',
        body: 'Calendar is not syncing appointments.',
        internal: false,
        createdAt: '2026-10-13T10:00:00Z',
      },
    ],
    created_at: '2026-10-13T10:00:00Z',
    updated_at: '2026-10-13T10:00:00Z',
  };

  describe('ticketsService.list', () => {
    it('successfully retrieves and maps all ticket threads', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: [mockTicketRow],
        error: null,
      } as any);

      const result = await ticketsService.list();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('tc_123456789abc');
      expect(result.items[0].subject).toBe('Issue with booking calendar');
      expect(result.items[0].messages).toHaveLength(1);
    });

    it('returns an empty list when no tickets exist', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: [],
        error: null,
      } as any);

      const result = await ticketsService.list();
      expect(result.items).toEqual([]);
    });

    it('translates database errors when listing tickets fails', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      } as any);

      await expect(ticketsService.list()).rejects.toThrowError(
        expect.objectContaining({
          code: 'permission_denied',
          status: 403,
        }),
      );
    });
  });

  describe('ticketsService.get', () => {
    it('retrieves a single ticket thread by id', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: [mockTicketRow],
        error: null,
      } as any);

      const result = await ticketsService.get('tc_123456789abc');
      expect(result.ticket.id).toBe('tc_123456789abc');
      expect(result.ticket.subject).toBe('Issue with booking calendar');
    });

    it('throws a 404 ApiError when the ticket does not exist', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: [],
        error: null,
      } as any);

      await expect(ticketsService.get('tc_nonexistent')).rejects.toThrowError(
        expect.objectContaining({
          code: 'not_found',
          status: 404,
          message: "We couldn't find that ticket.",
        }),
      );
    });
  });

  describe('ticketsService.message (Admin & Client Reply Flow)', () => {
    it('rejects sending an empty or whitespace message with validation error', async () => {
      await expect(ticketsService.message('tc_123456789abc', { body: '   ' })).rejects.toThrowError(
        expect.objectContaining({
          code: 'validation',
          status: 400,
          message: 'Write something before sending.',
        }),
      );
    });

    it('successfully sends a reply via app_add_ticket_message RPC', async () => {
      const updatedRow = {
        ...mockTicketRow,
        status: 'pending',
        messages: [
          ...mockTicketRow.messages,
          {
            id: 'msg-002',
            author: 'Support Admin',
            authorRole: 'admin',
            body: 'We have resolved the sync issue.',
            internal: false,
            createdAt: '2026-10-13T10:05:00Z',
          },
        ],
      };

      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: updatedRow,
        error: null,
      } as any);

      const result = await ticketsService.message('tc_123456789abc', {
        body: 'We have resolved the sync issue.',
        internal: false,
        status: 'pending',
      });

      expect(rpcSpy).toHaveBeenCalledWith('app_add_ticket_message', {
        p_ticket_id: 'tc_123456789abc',
        p_body: 'We have resolved the sync issue.',
        p_internal: false,
        p_status: 'pending',
      });

      expect(result.ticket.id).toBe('tc_123456789abc');
      expect(result.ticket.messages).toHaveLength(2);
      expect(result.ticket.messages[1].body).toBe('We have resolved the sync issue.');
      expect(result.ticket.status).toBe('pending');
    });

    it('properly marks staff internal notes when internal flag is true', async () => {
      const internalRow = {
        ...mockTicketRow,
        messages: [
          ...mockTicketRow.messages,
          {
            id: 'msg-003',
            author: 'Support Admin',
            authorRole: 'admin',
            body: 'Checking backend sync queue.',
            internal: true,
            createdAt: '2026-10-13T10:06:00Z',
          },
        ],
      };

      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: internalRow,
        error: null,
      } as any);

      const result = await ticketsService.message('tc_123456789abc', {
        body: 'Checking backend sync queue.',
        internal: true,
      });

      expect(rpcSpy).toHaveBeenCalledWith('app_add_ticket_message', {
        p_ticket_id: 'tc_123456789abc',
        p_body: 'Checking backend sync queue.',
        p_internal: true,
        p_status: null,
      });

      expect(result.ticket.messages[1].internal).toBe(true);
    });

    it('gracefully recovers from Postgres 22P02 casting failure (invalid_text_representation)', async () => {
      // Simulate earlier migration bug where `returning t.id into v_ticket` fails
      // with 22P02: invalid_text_representation
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: {
          code: '22P02',
          message: 'invalid input syntax for type json: "tc_123456789abc"',
        },
      } as any);

      // Simulate the fallback querying tickets and updating cleanly
      const fallbackUpdatedRow = {
        ...mockTicketRow,
        messages: [
          ...mockTicketRow.messages,
          {
            id: 'msg-fallback-01',
            author: 'Support Admin',
            authorRole: 'admin',
            body: 'Resilient fallback reply.',
            internal: false,
            createdAt: '2026-10-13T10:10:00Z',
          },
        ],
      };

      const selectSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockTicketRow, error: null }),
        }),
      });

      const updateSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: fallbackUpdatedRow, error: null }),
          }),
        }),
      });

      vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
        if (table === 'tickets') {
          return {
            select: selectSpy,
            update: updateSpy,
          } as any;
        }
        return {} as any;
      }) as any);

      const result = await ticketsService.message('tc_123456789abc', {
        body: 'Resilient fallback reply.',
      });

      expect(result.ticket.id).toBe('tc_123456789abc');
      expect(result.ticket.messages).toHaveLength(2);
      expect(result.ticket.messages[1].body).toBe('Resilient fallback reply.');
    });

    it('gracefully recovers when app_add_ticket_message RPC is missing (PGRST202)', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST202',
          message: 'Could not find the function app_add_ticket_message in schema cache',
        },
      } as any);

      const fallbackRow = {
        ...mockTicketRow,
        messages: [
          ...mockTicketRow.messages,
          {
            id: 'msg-fallback-02',
            author: 'Support Admin',
            authorRole: 'admin',
            body: 'Fallback when RPC missing.',
            internal: false,
            createdAt: '2026-10-13T10:12:00Z',
          },
        ],
      };

      vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
        if (table === 'tickets') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: mockTicketRow, error: null }),
              }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => ({ data: fallbackRow, error: null }),
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      }) as any);

      const result = await ticketsService.message('tc_123456789abc', {
        body: 'Fallback when RPC missing.',
      });

      expect(result.ticket.messages[1].body).toBe('Fallback when RPC missing.');
    });

    it('maps RLS permission denied (42501) with AAL2 two-factor guidance for admin write', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: {
          code: '42501',
          message: 'permission denied for function app_add_ticket_message',
        },
      } as any);

      await expect(
        ticketsService.message('tc_123456789abc', { body: 'Reply without AAL2' }),
      ).rejects.toThrowError(
        expect.objectContaining({
          code: 'permission_denied',
          status: 403,
          message: expect.stringContaining('verify your two-factor code first'),
        }),
      );
    });

    it('throws update_failed when RPC returns empty data without error', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: null,
      } as any);

      await expect(
        ticketsService.message('tc_123456789abc', { body: 'Valid message body' }),
      ).rejects.toThrowError(
        expect.objectContaining({
          code: 'update_failed',
          status: 400,
        }),
      );
    });
  });
});
