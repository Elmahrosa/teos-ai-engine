import { GET } from '@/app/api/audit/route';
import { getServerSession } from 'next-auth';
import { isAdminEmail } from '@/lib/access';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));
jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));
jest.mock('@/lib/access', () => ({
  isAdminEmail: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      findMany: jest.fn(),
    },
  },
}));

const mockedGetServerSession = jest.mocked(getServerSession);
const mockedIsAdminEmail = jest.mocked(isAdminEmail);
const auditFindMany = prisma.auditLog.findMany as jest.Mock;

describe('app/api/audit/route.ts - GET', () => {
  const adminEmail = 'admin@example.com';
  const mockLogs = [
    {
      id: 'log-1',
      userId: 'user-1',
      action: 'login',
      metadata: null,
      ip: '203.0.113.9',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      user: { id: 'user-1', email: 'someone@example.com', name: 'Someone' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    auditFindMany.mockResolvedValue(mockLogs);
  });

  describe('when the caller is not an authenticated admin', () => {
    // These assertions are the regression guard for F-D-001: the committed
    // version of this route had no authentication at all and returned audit
    // records (including user email, name and IP) to any anonymous caller.
    it('should return 401 and not touch the database when there is no session', async () => {
      mockedGetServerSession.mockResolvedValue(null);

      const res = await GET();

      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
      expect(auditFindMany).not.toHaveBeenCalled();
    });

    it('should return 401 when the session has no email', async () => {
      mockedGetServerSession.mockResolvedValue({ user: {} } as any);
      mockedIsAdminEmail.mockReturnValue(false);

      const res = await GET();

      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
      expect(auditFindMany).not.toHaveBeenCalled();
    });

    it('should return 401 and not touch the database for an authenticated non-admin', async () => {
      mockedGetServerSession.mockResolvedValue({
        user: { email: 'regular-user@example.com' },
      } as any);
      mockedIsAdminEmail.mockReturnValue(false);

      const res = await GET();

      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
      // The critical assertion: a non-admin must not be able to reach the data.
      expect(auditFindMany).not.toHaveBeenCalled();
    });
  });

  describe('when the caller is an authenticated admin', () => {
    it('should return the audit logs', async () => {
      mockedGetServerSession.mockResolvedValue({
        user: { email: adminEmail },
      } as any);
      mockedIsAdminEmail.mockReturnValue(true);

      const res = await GET();

      expect(res.status).toBe(200);
      // Dates are serialized to ISO strings by NextResponse.json.
      await expect(res.json()).resolves.toEqual(
        JSON.parse(JSON.stringify(mockLogs))
      );
      expect(mockedIsAdminEmail).toHaveBeenCalledWith(adminEmail);
      expect(auditFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });

    it('should return 500 when the database query fails', async () => {
      mockedGetServerSession.mockResolvedValue({
        user: { email: adminEmail },
      } as any);
      mockedIsAdminEmail.mockReturnValue(true);
      auditFindMany.mockRejectedValue(new Error('Database error'));

      const res = await GET();

      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({
        error: 'Failed to fetch audit log',
      });
    });
  });
});