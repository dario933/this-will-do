import { Platform } from 'react-native';
import Purchases, {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesPackage,
} from 'react-native-purchases';
import {
  unavailablePurchaseState,
  type PurchaseState,
} from './state.ts';

export {
  applyVerifiedPurchase,
  loadingPurchaseState,
  unavailablePurchaseState,
  type PurchaseState,
  type PurchaseStatus,
} from './state.ts';

export interface PurchaseService {
  load(): Promise<PurchaseState>;
  purchase(): Promise<PurchaseState>;
  restore(): Promise<PurchaseState>;
}

const ENTITLEMENT_IDENTIFIER = 'full_box';
const PACKAGE_IDENTIFIER = '$rc_lifetime';
const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;

let configurePromise: Promise<boolean> | null = null;
let cachedPackage: PurchasesPackage | null = null;

function isVerified(customerInfo: CustomerInfo): boolean {
  const entitlement = customerInfo.entitlements.active[ENTITLEMENT_IDENTIFIER];
  if (!entitlement) return false;
  return entitlement.verification === Purchases.VERIFICATION_RESULT.VERIFIED
    || entitlement.verification === Purchases.VERIFICATION_RESULT.VERIFIED_ON_DEVICE;
}

function stateFromCustomerInfo(
  customerInfo: CustomerInfo,
  localizedPrice: string | null,
  successStatus: 'entitled' | 'restored' = 'entitled',
): PurchaseState {
  if (!isVerified(customerInfo)) {
    return {
      configured: true,
      entitled: false,
      localizedPrice,
      status: successStatus === 'restored' ? 'restored' : 'denied',
      message: successStatus === 'restored'
        ? 'No verified Full Box purchase was found for this Apple ID.'
        : 'Apple completed the request, but Full Box access could not be verified.',
    };
  }

  return {
    configured: true,
    entitled: true,
    localizedPrice,
    status: successStatus,
    message: successStatus === 'restored'
      ? 'Your verified Full Box purchase was restored.'
      : 'Full Box is unlocked with a verified Apple purchase.',
  };
}

function isPurchasesError(error: unknown): error is PurchasesError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function errorState(error: unknown, localizedPrice: string | null): PurchaseState {
  if (isPurchasesError(error) && error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
    return {
      configured: true,
      entitled: false,
      localizedPrice,
      status: 'cancelled',
      message: 'Purchase cancelled. Nothing was charged.',
    };
  }

  const deniedCodes: PURCHASES_ERROR_CODE[] = [
    PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR,
    PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR,
    PURCHASES_ERROR_CODE.INVALID_RECEIPT_ERROR,
    PURCHASES_ERROR_CODE.INSUFFICIENT_PERMISSIONS_ERROR,
    PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR,
  ];
  if (isPurchasesError(error) && deniedCodes.includes(error.code)) {
    return {
      configured: true,
      entitled: false,
      localizedPrice,
      status: 'denied',
      message: error.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR
        ? 'Apple is still processing this purchase. Full Box will unlock after verification.'
        : 'Apple did not authorize this purchase. Nothing was unlocked.',
    };
  }

  return {
    configured: true,
    entitled: false,
    localizedPrice,
    status: 'unavailable',
    message: 'The App Store could not be reached. Please try again later.',
  };
}

async function configure(): Promise<boolean> {
  if (configurePromise) return configurePromise;
  configurePromise = (async () => {
    if (Platform.OS !== 'ios' || !IOS_API_KEY) return false;
    if (!(await Purchases.isConfigured())) {
      Purchases.configure({
        apiKey: IOS_API_KEY,
        entitlementVerificationMode: Purchases.ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL,
      });
    }
    return true;
  })();
  return configurePromise;
}

async function getPackage(): Promise<PurchasesPackage | null> {
  if (cachedPackage) return cachedPackage;
  const offerings = await Purchases.getOfferings();
  cachedPackage = offerings.current?.availablePackages.find(
    item => item.identifier === PACKAGE_IDENTIFIER,
  ) ?? offerings.current?.lifetime ?? null;
  return cachedPackage;
}

export const purchaseService: PurchaseService = {
  async load() {
    try {
      if (!(await configure())) return unavailablePurchaseState;
      const [customerInfo, packageToPurchase] = await Promise.all([
        Purchases.getCustomerInfo(),
        getPackage(),
      ]);
      const localizedPrice = packageToPurchase?.product.priceString ?? null;
      if (!packageToPurchase) {
        return {
          configured: false,
          entitled: false,
          localizedPrice,
          status: 'unavailable',
          message: 'The Full Box product is not available from Apple yet.',
        };
      }
      return isVerified(customerInfo)
        ? stateFromCustomerInfo(customerInfo, localizedPrice)
        : {
            configured: true,
            entitled: false,
            localizedPrice,
            status: 'unavailable',
            message: 'Full Box is available as a one-time Apple purchase.',
          };
    } catch (error) {
      return errorState(error, cachedPackage?.product.priceString ?? null);
    }
  },
  async purchase() {
    try {
      if (!(await configure())) return unavailablePurchaseState;
      const packageToPurchase = await getPackage();
      if (!packageToPurchase) return unavailablePurchaseState;
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return stateFromCustomerInfo(customerInfo, packageToPurchase.product.priceString);
    } catch (error) {
      return errorState(error, cachedPackage?.product.priceString ?? null);
    }
  },
  async restore() {
    try {
      if (!(await configure())) return unavailablePurchaseState;
      const [customerInfo, packageToPurchase] = await Promise.all([
        Purchases.restorePurchases(),
        getPackage(),
      ]);
      return stateFromCustomerInfo(
        customerInfo,
        packageToPurchase?.product.priceString ?? null,
        'restored',
      );
    } catch (error) {
      return errorState(error, cachedPackage?.product.priceString ?? null);
    }
  },
};