import { provisionPlan, BillingError } from '@/lib/billing';
import { prisma } from '@/lib/prisma';
import { generateRequestId } from '@/lib/trace';
import { PLANS_MATRIX } from '@/lib/billing';

// Mock the dependencies with proper shape
jest.mock('@/lib/prisma', () => {
  return {
    prisma: {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    },
  };
});
jest.mock('@/lib/trace');

const userFindUnique = prisma.user.findUnique as jest.Mock;
const userUpdate = prisma.user.update as jest.Mock;
const transactionCreate = prisma.transaction.create as jest.Mock;
const transactionFindUnique = prisma.transaction.findUnique as jest.Mock;
const auditLogCreate = prisma.auditLog.create as jest.Mock;
const mockedGenerateRequestId = jest.mocked(generateRequestId);

describe('lib/billing.ts - provisionPlan', () => {
  const mockEmail = 'test@example.com';
  const mockPlanId = 'pro_monthly';
  const mockGateway: string = 'DODO';
  const mockPaymentRef = 'pay_123';
  const mockAmountUSD = 29;
  const mockRequestId = 'req_123';
  const mockNow = new Date('2026-01-01T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGenerateRequestId.mockReturnValue(mockRequestId);
    // Use Jest's built-in mock timers (modern is the default in Jest 30)
    jest.useFakeTimers();
    jest.setSystemTime(mockNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('successful provisioning', () => {
    it('should successfully provision a plan for existing user', async () => {
      // Mock existing user
      userFindUnique.mockResolvedValue({
        id: 'user_123',
        email: mockEmail.toLowerCase(),
        plan: 'free',
      });
      // Mock transaction.create
      const mockTransaction = {
        id: 'tx_123',
        userId: 'user_123',
        gateway: mockGateway,
        status: "COMPLETED",
        planId: mockPlanId,
        amountUSD: mockAmountUSD,
        amountPi: null,
        paymentRef: mockPaymentRef,
        creditsAdded: PLANS_MATRIX[mockPlanId as keyof typeof PLANS_MATRIX].credits,
        metadata: { requestId: mockRequestId },
        createdAt: mockNow,
        updatedAt: mockNow,
      };
      transactionCreate.mockResolvedValue(mockTransaction);
      // Mock user.update
      const mockUpdatedUser = {
        id: 'user_123',
        email: mockEmail.toLowerCase(),
        plan: mockPlanId,
        status: 'active',
        credits: 50 + PLANS_MATRIX[mockPlanId as keyof typeof PLANS_MATRIX].credits, // assuming existing credits 50
        planActivatedAt: mockNow,
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        updatedAt: mockNow,
      };
      userUpdate.mockResolvedValue(mockUpdatedUser);
      // Mock auditLog.create
      const mockAuditLog = {
        id: 'log_123',
        userId: 'user_123',
        action: 'plan-upgraded',
        metadata: {},
        ip: null,
        createdAt: mockNow,
      };
      auditLogCreate.mockResolvedValue(mockAuditLog);
      // Mock $transaction to return results in the same order as the operations
      const transactionRunner = prisma.$transaction as jest.Mock;
      transactionRunner.mockImplementation((operations: unknown[]) =>
        Promise.all(operations.map((op) => Promise.resolve(op)))
      );

      const result = await provisionPlan({
        email: mockEmail,
        planId: mockPlanId,
        gateway: mockGateway,
        paymentRef: mockPaymentRef,
        amountUSD: mockAmountUSD,
      });

      expect(result).toEqual({
        success: true,
        duplicate: false,
        userId: 'user_123',
        creditsAdded: PLANS_MATRIX[mockPlanId as keyof typeof PLANS_MATRIX].credits,
        transactionId: 'tx_123',
      });

      // Verify user was updated
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        data: expect.objectContaining({
          plan: mockPlanId,
          status: 'active',
          credits: expect.objectContaining({ increment: expect.any(Number) }),
          planActivatedAt: mockNow,
          planExpiresAt: expect.any(Date),
          updatedAt: mockNow,
        }),
      });

      // Verify transaction was created
      expect(transactionCreate).toHaveBeenCalledWith({
        data: {
          userId: 'user_123',
          gateway: mockGateway,
          status: "COMPLETED",
          planId: mockPlanId,
          amountUSD: mockAmountUSD,
          amountPi: null,
          paymentRef: mockPaymentRef,
          creditsAdded: PLANS_MATRIX[mockPlanId as keyof typeof PLANS_MATRIX].credits,
          metadata: { requestId: mockRequestId },
        },
      });

      // Verify audit log was created
      expect(auditLogCreate).toHaveBeenCalledWith({
        data: {
          userId: 'user_123',
          action: 'plan-upgraded',
          metadata: expect.objectContaining({
            email: mockEmail.toLowerCase(),
            planId: mockPlanId,
            gateway: mockGateway,
            amountUSD: mockAmountUSD,
            paymentRef: mockPaymentRef,
            creditsAdded: PLANS_MATRIX[mockPlanId as keyof typeof PLANS_MATRIX].credits,
            requestId: mockRequestId,
          }),
        },
      });
    });

    it('should handle existing user without duplicate payment (free to pro)', async () => {
      // Mock existing user on free plan with some credits
      userFindUnique.mockResolvedValue({
        id: 'user_123',
        email: mockEmail.toLowerCase(),
        plan: 'free',
        credits: 30,
      });

      // Mock transaction.create
      const mockTransaction = {
        id: 'tx_123',
        userId: 'user_123',
        gateway: mockGateway,
        status: "COMPLETED",
        planId: mockPlanId,
        amountUSD: mockAmountUSD,
        amountPi: null,
        paymentRef: mockPaymentRef,
        creditsAdded: PLANS_MATRIX[mockPlanId as keyof typeof PLANS_MATRIX].credits,
        metadata: { requestId: mockRequestId },
        createdAt: mockNow,
        updatedAt: mockNow,
      };
      transactionCreate.mockResolvedValue(mockTransaction);

      // Mock user.update
      const mockUpdatedUser = {
        id: 'user_123',
        email: mockEmail.toLowerCase(),
        plan: mockPlanId,
        status: 'active',
        credits: 30 + PLANS_MATRIX[mockPlanId as keyof typeof PLANS_MATRIX].credits,
        planActivatedAt: mockNow,
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        updatedAt: mockNow,
      };
      userUpdate.mockResolvedValue(mockUpdatedUser);

      // Mock auditLog.create
      const mockAuditLog = {
        id: 'log_123',
        userId: 'user_123',
        action: 'plan-upgraded',
        metadata: {},
        ip: null,
        createdAt: mockNow,
      };
      auditLogCreate.mockResolvedValue(mockAuditLog);

      // Mock $transaction
      const transactionRunner = prisma.$transaction as jest.Mock;
      transactionRunner.mockImplementation((operations: unknown[]) =>
        Promise.all(operations.map((op) => Promise.resolve(op)))
      );

      const result = await provisionPlan({
        email: mockEmail,
        planId: mockPlanId,
        gateway: mockGateway,
        paymentRef: mockPaymentRef,
        amountUSD: mockAmountUSD,
      });

      expect(result).toEqual({
        success: true,
        duplicate: false,
        userId: 'user_123',
        creditsAdded: PLANS_MATRIX[mockPlanId as keyof typeof PLANS_MATRIX].credits,
        transactionId: 'tx_123',
      });

      // Verify user was updated (not created)
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        data: expect.objectContaining({
          plan: mockPlanId,
          status: 'active',
          credits: expect.objectContaining({ increment: expect.any(Number) }),
          planActivatedAt: mockNow,
          planExpiresAt: expect.any(Date),
          updatedAt: mockNow,
        }),
      });
      // Ensure user.findUnique was called (we didn't mock create, but ensure it's not called implicitly)
      expect(userFindUnique).toHaveBeenCalled();
    });
  });

  describe('duplicate payment protection', () => {
    it('should return existing transaction for duplicate paymentRef', async () => {
      // Mock existing transaction
      const mockExistingTx = {
        id: 'tx_existing',
        userId: 'user_123',
        creditsAdded: 1000,
      };
      transactionFindUnique.mockResolvedValue(mockExistingTx);

      const result = await provisionPlan({
        email: mockEmail,
        planId: mockPlanId,
        gateway: mockGateway,
        paymentRef: mockPaymentRef,
        amountUSD: mockAmountUSD,
      });

      expect(result).toEqual({
        success: true,
        duplicate: true,
        userId: 'user_123',
        creditsAdded: 1000,
        transactionId: 'tx_existing',
      });

      // Verify no user or transaction creation happened
      expect(userFindUnique).not.toHaveBeenCalled();
      expect(userUpdate).not.toHaveBeenCalled();
      expect(transactionCreate).not.toHaveBeenCalled();
      expect(auditLogCreate).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw BillingError for user not found', async () => {
      // Mock user not found
      userFindUnique.mockResolvedValue(null);
      // Ensure no duplicate transaction
      transactionFindUnique.mockResolvedValue(null);

      await expect(
        provisionPlan({
          email: mockEmail,
          planId: mockPlanId,
          gateway: mockGateway,
          paymentRef: mockPaymentRef,
          amountUSD: mockAmountUSD,
        })
      ).rejects.toThrow(BillingError);
    });

    it('should propagate unexpected errors from user.findUnique', async () => {
      // Mock unexpected error in findUnique
      userFindUnique.mockRejectedValueOnce(
        new Error('Database connection failed')
      );
      transactionFindUnique.mockResolvedValue(null);

      await expect(
        provisionPlan({
          email: mockEmail,
          planId: mockPlanId,
          gateway: mockGateway,
          paymentRef: mockPaymentRef,
          amountUSD: mockAmountUSD,
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should propagate unexpected errors from transaction.findUnique', async () => {
      // Mock user found
      userFindUnique.mockResolvedValueOnce({
        id: 'user_123',
        email: mockEmail.toLowerCase(),
        plan: 'free',
      });
      // Mock unexpected error in transaction.findUnique
      transactionFindUnique.mockRejectedValueOnce(
        new Error('Transaction lookup failed')
      );

      await expect(
        provisionPlan({
          email: mockEmail,
          planId: mockPlanId,
          gateway: mockGateway,
          paymentRef: mockPaymentRef,
          amountUSD: mockAmountUSD,
        })
      ).rejects.toThrow('Transaction lookup failed');
    });
  });
});