import { MATERIALS, DELIVERY_ZONES, SITE_CONFIG, type MaterialItem, type DeliveryZone } from '../data/siteConfig';

export type OrderUnit = 'ton' | 'm3' | 'bag';

export interface CalculationInput {
  materialId: string;
  unit: OrderUnit;
  quantity: number;
  zoneId: string;
  needLoaders?: boolean;
  loadersCount?: number;
  loadersHours?: number;
}

export interface CalculationResult {
  material: MaterialItem;
  zone: DeliveryZone;
  isCustomZone: boolean;
  quantity: number;
  unit: OrderUnit;
  estimatedTons: number;
  estimatedM3: number;
  estimatedBags: number;
  recommendedVehicle: string;
  tripsCount: number;
  materialCost: number;
  deliveryCost: number;
  loadersCost: number;
  totalCost: number;
  summaryText: string;
  whatsappUrl: string;
  telegramUrl: string;
}

export function pluralTrips(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'рейс';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'рейса';
  return 'рейсов';
}

/** Основная цена для витрины: за м³ у того, что продаётся кубами (дрова), иначе за тонну. */
export function basePrice(m: MaterialItem): { value: number; unit: 'т' | 'м³' } {
  if (m.defaultUnit === 'm3' && m.pricePerM3) return { value: m.pricePerM3, unit: 'м³' };
  if (m.pricePerTon) return { value: m.pricePerTon, unit: 'т' };
  return { value: m.pricePerM3 ?? 0, unit: 'м³' };
}

/** Строки таблицы «объём → машина → сумма с доставкой» для страницы материала. Считает тот же калькулятор. */
export function priceRows(materialId: string, zoneId = 'cheboksary') {
  const m = MATERIALS.find((x) => x.id === materialId) || MATERIALS[0];
  const steps: { unit: OrderUnit; quantity: number }[] =
    m.defaultUnit === 'm3'
      ? [{ unit: 'bag', quantity: 10 }, { unit: 'm3', quantity: 1 }, { unit: 'm3', quantity: 5 }, { unit: 'm3', quantity: 10 }, { unit: 'm3', quantity: 15 }]
      : [{ unit: 'bag', quantity: 10 }, { unit: 'ton', quantity: 1.5 }, { unit: 'ton', quantity: 5 }, { unit: 'ton', quantity: 10 }, { unit: 'ton', quantity: 15 }];
  return steps.map((st) => calculateDelivery({ materialId: m.id, zoneId, ...st }));
}

export function calculateDelivery(input: CalculationInput): CalculationResult {
  const material = MATERIALS.find((m) => m.id === input.materialId) || MATERIALS[0];
  const foundZone = DELIVERY_ZONES.find((z) => z.id === input.zoneId);
  const isCustomZone = !foundZone;
  const zone = foundZone || DELIVERY_ZONES[0];

  const rawQty = Number.isFinite(input.quantity) && input.quantity > 0 ? input.quantity : 1;
  const quantity = Math.min(Math.max(rawQty, 0.5), 500);

  const bagWeightTons = (material.bagWeightKg || 50) / 1000;
  const density = material.bulkDensity || 1.4; // т/м³

  let estimatedTons = 0;
  let estimatedM3 = 0;
  let estimatedBags = 0;
  let materialCost = 0;

  if (input.unit === 'bag') {
    estimatedBags = Math.ceil(quantity);
    estimatedTons = Number((estimatedBags * bagWeightTons).toFixed(2));
    estimatedM3 = Number((estimatedTons / density).toFixed(2));
    materialCost = estimatedBags * material.pricePerBag;
  } else if (input.unit === 'm3') {
    estimatedM3 = Number(quantity.toFixed(2));
    estimatedTons = Number((estimatedM3 * density).toFixed(2));
    estimatedBags = Math.ceil(estimatedTons / bagWeightTons);
    const unitPrice = material.pricePerM3 ?? Math.round((material.pricePerTon || 500) * density);
    materialCost = Math.round(estimatedM3 * unitPrice);
  } else {
    // 'ton'
    estimatedTons = Number(quantity.toFixed(2));
    estimatedM3 = Number((estimatedTons / density).toFixed(2));
    estimatedBags = Math.ceil(estimatedTons / bagWeightTons);
    const unitPrice = material.pricePerTon ?? Math.round((material.pricePerM3 || 600) / density);
    materialCost = Math.round(estimatedTons * unitPrice);
  }

  // Подбор машины по двум ограничениям: тоннаж (estimatedTons) и объём кузова (estimatedM3)
  let recommendedVehicle = '';
  let tripsCount = 1;
  let singleTripDelivery = zone.deliveryPriceZil;

  if (zone.id === 'pickup') {
    recommendedVehicle = 'Самовывоз с площадки (500 м от аэропорта)';
    tripsCount = 1;
    singleTripDelivery = 0;
  } else if (estimatedTons <= 1.5 && estimatedM3 <= 9) {
    recommendedVehicle = 'ГАЗель (до 1.5 т)';
    tripsCount = 1;
    singleTripDelivery = zone.deliveryPriceGazelle;
  } else if (estimatedTons <= 5 && estimatedM3 <= 6) {
    recommendedVehicle = 'Самосвал ЗИЛ / ГАЗ (до 5 т, боковой свал)';
    tripsCount = 1;
    singleTripDelivery = zone.deliveryPriceZil;
  } else if (estimatedTons <= 10 && estimatedM3 <= 8) {
    recommendedVehicle = 'Самосвал КамАЗ (до 10 т)';
    tripsCount = 1;
    singleTripDelivery = zone.deliveryPriceKamaz;
  } else if (estimatedTons <= 15 && estimatedM3 <= 12) {
    recommendedVehicle = 'Самосвал КамАЗ (до 15 т)';
    tripsCount = 1;
    singleTripDelivery = zone.deliveryPriceKamaz;
  } else if (estimatedTons <= 20 && estimatedM3 <= 15) {
    recommendedVehicle = 'Тяжёлый самосвал КамАЗ / МАЗ (до 20 т)';
    tripsCount = 1;
    singleTripDelivery = zone.deliveryPriceKamaz + 800;
  } else {
    // Несколько рейсов по 15 т / 12 м³
    const tripsByWeight = Math.ceil(estimatedTons / 15);
    const tripsByVolume = Math.ceil(estimatedM3 / 12);
    tripsCount = Math.max(tripsByWeight, tripsByVolume, 1);
    recommendedVehicle = `${tripsCount} ${pluralTrips(tripsCount)} КамАЗа (по 15 т)`;
    singleTripDelivery = zone.deliveryPriceKamaz;
  }

  const deliveryCost = zone.id === 'pickup' ? 0 : singleTripDelivery * tripsCount;

  const loadersCount = input.needLoaders ? Math.max(input.loadersCount || 2, 1) : 0;
  const loadersHours = input.needLoaders ? Math.max(input.loadersHours || 2, 2) : 0;
  const loadersCost = input.needLoaders ? loadersCount * loadersHours * 600 : 0;

  const totalCost = materialCost + deliveryCost + loadersCost;

  const unitLabelRu =
    input.unit === 'bag'
      ? `${estimatedBags} мешк. (~${estimatedTons} т)`
      : input.unit === 'm3'
      ? `${estimatedM3} м³ (~${estimatedTons} т)`
      : `${estimatedTons} т (~${estimatedM3} м³)`;

  const loadersNote = input.needLoaders
    ? `\nГрузчики: ${loadersCount} чел. × ${loadersHours} ч (~${loadersCost.toLocaleString('ru-RU')} ₽)`
    : '';

  const summaryText =
    `Заявка с сайта Строй Ресурс 21:\n` +
    `• Материал: ${material.name}\n` +
    `• Объём: ${unitLabelRu}\n` +
    `• Зона доставки: ${isCustomZone ? 'Другой район Чувашии (уточнить)' : zone.name}\n` +
    `• Машина: ${recommendedVehicle}${loadersNote}\n` +
    `• Примерный расчёт: ~${totalCost.toLocaleString('ru-RU')} ₽ (уточнить по телефону)`;

  const encoded = encodeURIComponent(summaryText);
  const whatsappUrl = `${SITE_CONFIG.socials.whatsappUrl}?text=${encoded}`;
  const telegramUrl = `${SITE_CONFIG.socials.telegram}`;

  return {
    material,
    zone,
    isCustomZone,
    quantity,
    unit: input.unit,
    estimatedTons,
    estimatedM3,
    estimatedBags,
    recommendedVehicle,
    tripsCount,
    materialCost,
    deliveryCost,
    loadersCost,
    totalCost,
    summaryText,
    whatsappUrl,
    telegramUrl,
  };
}
