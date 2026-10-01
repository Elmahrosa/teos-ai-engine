import { authorizeCredentials } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/password';
import { createAuditLog } from '@/lib/session';

// Mock the dependencies with proper shape
jest.mock('@/lib/prisma', () => {
  return {
    prisma: {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    },
  };
});
jest.mock('@/lib/password');
jest.mock('@/lib/session');

const mockedHashPassword = jest.mocked(hashPassword);
const mockedVerifyPassword = jest.mocked(verifyPassword);
const mockedCreateAuditLog = jest.mocked(createAuditLog);

describe('lib/auth.ts - authorizeCredentials', () => {
  const mockEmail = 'test@example.com';
  const mockPassword = 'password123';
  const mockName = 'Test User';
  const mockUserId = 'user-id-123';
  const mockUser = {
    id: mockUserId,
    email: mockEmail,
    name: mockName,
    role: 'user',
    plan: 'free',
    passwordHash: '$2a$10$hashedpassword',
    status: 'trial',
    totalPostsUsed: 0,
    dailyPostsUsed: 0,
    credits: 0,
    lastActiveAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: null,
    image: null,
    planActivatedAt: null,
    planExpiresAt: null,
    isAdmin: false,
    trialEndsAt: null,
    accounts: [],
    sessions: [],
    posts: [],
    resetTokens: [],
    refreshTokens: [],
    auditLogs: [],
    mediaJobs: [],
    transactions: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when user exists with password hash', () => {
    it('should return user if password is correct', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockedVerifyPassword.mockResolvedValue(true);

      const result = await authorizeCredentials({
        email: mockEmail,
        password: mockPassword,
        name: mockName,
      });

      expect(result).toEqual({
        id: mockUserId,
        email: mockEmail,
        name: mockName,
        role: 'user',
        plan: 'free',
        trialEndsAt: null,
        isAdmin: false,
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: mockEmail } });
      expect(mockedVerifyPassword).toHaveBeenCalledWith(mockPassword, mockUser.passwordHash);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { lastActiveAt: expect.any(Date) },
      });
      expect(mockedCreateAuditLog).toHaveBeenCalledWith(mockUserId, 'login', {
        email: mockEmail,
        method: 'credentials',
      });
    });

    it('should return null if password is incorrect', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockedVerifyPassword.mockResolvedValue(false);

      const result = await authorizeCredentials({
        email: mockEmail,
        password: 'wrongpassword',
        name: mockName,
      });

      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: mockEmail } });
      expect(mockedVerifyPassword).toHaveBeenCalledWith('wrongpassword', mockUser.passwordHash);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(mockedCreateAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('when user exists without password hash', () => {
    it('should return null if no password provided', async () => {
      const userWithoutHash = { ...mockUser, passwordHash: null };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(userWithoutHash);

      const result = await authorizeCredentials({
        email: mockEmail,
        password: '',
        name: mockName,
      });

      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: mockEmail } });
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(mockedCreateAuditLog).not.toHaveBeenCalled();
    });

    it('should reject login and never set a password hash if a password is provided', async () => {
      // Regression test: an OAuth-created account (null passwordHash) must
      // never have a caller-supplied password adopted for it, otherwise anyone
      // knowing the victim's email could take over the account.
      const userWithoutHash = { ...mockUser, passwordHash: null };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(userWithoutHash);

      const result = await authorizeCredentials({
        email: mockEmail,
        password: mockPassword,
        name: mockName,
      });

      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: mockEmail } });
      expect(mockedHashPassword).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(mockedCreateAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('when user does not exist', () => {
    it('should return null if no password provided', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await authorizeCredentials({
        email: mockEmail,
        password: '',
        name: mockName,
      });

      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: mockEmail } });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(mockedCreateAuditLog).not.toHaveBeenCalled();
    });

    it('should create new user and return user if password provided', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      mockedHashPassword.mockResolvedValue('$2a$10$newhashedpassword');
      const createdUser = { ...mockUser, id: mockUserId };
      (prisma.user.create as jest.Mock).mockResolvedValue(createdUser);

      const result = await authorizeCredentials({
        email: mockEmail,
        password: mockPassword,
        name: mockName,
      });

      expect(result).toEqual({
        id: mockUserId,
        email: mockEmail,
        name: mockName,
        role: 'user',
        plan: 'free',
        trialEndsAt: null,
        isAdmin: false,
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: mockEmail } });
      expect(mockedHashPassword).toHaveBeenCalledWith(mockPassword);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: mockEmail,
          name: mockName,
          role: 'user',
          plan: 'free',
          passwordHash: '$2a$10$newhashedpassword',
        },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { lastActiveAt: expect.any(Date) },
      });
      expect(mockedCreateAuditLog).toHaveBeenCalledWith(mockUserId, 'login', {
        email: mockEmail,
        method: 'credentials',
      });
    });
  });

  describe('when email is missing', () => {
    it('should return null', async () => {
      const result = await authorizeCredentials({
        email: undefined,
        password: mockPassword,
        name: mockName,
      });

      expect(result).toBeNull();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('when an unexpected error occurs', () => {
    it('should return null', async () => {
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await authorizeCredentials({
        email: mockEmail,
        password: mockPassword,
        name: mockName,
      });

      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: mockEmail } });
    });
  });
});