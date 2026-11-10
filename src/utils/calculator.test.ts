import { describe, it, expect } from 'vitest';
import { calculateDelivery, pluralTrips, basePrice, priceRows } from './calculator';
import { MATERIALS } from '../data/siteConfig';

describe('Инженерный калькулятор доставки Строй Ресурс 21', () => {
  it('пересчитывает мешки в тонны и м³ для речного песка (50 кг мешок, плотность 1.5)', () => {
    const res = calculateDelivery({
      materialId: 'pesok-rechnoy',
      unit: 'bag',
      quantity: 20, // 20 мешков по 50 кг = 1 тонна
      zoneId: 'cheboksary',
    });

    expect(res.estimatedBags).toBe(20);
    expect(res.estimatedTons).toBe(1);
    expect(res.estimatedM3).toBeCloseTo(0.67, 1);
    expect(res.recommendedVehicle).toContain('ГАЗель');
    expect(res.totalCost).toBe(20 * 150 + 1500);
  });

  it('выбирает ЗИЛ/ГАЗ при заказе 5 тонн песка', () => {
    const res = calculateDelivery({
      materialId: 'pesok-rechnoy',
      unit: 'ton',
      quantity: 5,
      zoneId: 'cheboksary',
    });

    expect(res.recommendedVehicle).toContain('ЗИЛ');
    expect(res.tripsCount).toBe(1);
  });

  it('учитывает ограничение по объёму кузова для лёгких материалов (например, 10 м³ дров или торфа)', () => {
    const res = calculateDelivery({
      materialId: 'drova-ugol',
      unit: 'm3',
      quantity: 10, // 10 м³ * 0.75 = 7.5 т, но по объёму 10 м³ не влезет в ЗИЛ (6 м³) или малый КамАЗ (8 м³)
      zoneId: 'novocheboksarsk',
    });

    expect(res.estimatedM3).toBe(10);
    expect(res.recommendedVehicle).toContain('КамАЗ (до 15 т)');
  });

  it('разбивает крупный заказ (30 тонн) на несколько рейсов КамАЗа', () => {
    const res = calculateDelivery({
      materialId: 'shcheben',
      unit: 'ton',
      quantity: 30,
      zoneId: 'cheboksary',
    });

    expect(res.tripsCount).toBe(2);
    expect(res.recommendedVehicle).toContain('2 рейса КамАЗа');
  });

  it('корректно обрабатывает зону вне списка (isCustomZone = true)', () => {
    const res = calculateDelivery({
      materialId: 'pesok-rechnoy',
      unit: 'ton',
      quantity: 10,
      zoneId: 'unknown-village',
    });

    expect(res.isCustomZone).toBe(true);
    expect(res.summaryText).toContain('Другой район Чувашии');
  });

  it('склоняет число рейсов: 5 рейсов, 21 рейс, 3 рейса', () => {
    expect(pluralTrips(1)).toBe('рейс');
    expect(pluralTrips(3)).toBe('рейса');
    expect(pluralTrips(5)).toBe('рейсов');
    expect(pluralTrips(11)).toBe('рейсов');
    expect(pluralTrips(21)).toBe('рейс');
    const res = calculateDelivery({ materialId: 'shcheben', unit: 'ton', quantity: 75, zoneId: 'cheboksary' });
    expect(res.tripsCount).toBe(5);
    expect(res.recommendedVehicle).toContain('5 рейсов');
  });

  it('граница Газели: 1.5 т ещё Газель, 1.55 т уже ЗИЛ', () => {
    expect(calculateDelivery({ materialId: 'pesok-rechnoy', unit: 'ton', quantity: 1.5, zoneId: 'cheboksary' }).recommendedVehicle).toContain('ГАЗель');
    expect(calculateDelivery({ materialId: 'pesok-rechnoy', unit: 'ton', quantity: 1.55, zoneId: 'cheboksary' }).recommendedVehicle).toContain('ЗИЛ');
  });

  it('самовывоз не добавляет доставку', () => {
    const res = calculateDelivery({ materialId: 'pesok-rechnoy', unit: 'ton', quantity: 5, zoneId: 'pickup' });
    expect(res.deliveryCost).toBe(0);
    expect(res.totalCost).toBe(res.materialCost);
  });

  it('витринная цена дров — за м³, песка — за тонну', () => {
    expect(basePrice(MATERIALS.find((m) => m.id === 'drova-ugol')!)).toEqual({ value: 2400, unit: 'м³' });
    expect(basePrice(MATERIALS.find((m) => m.id === 'pesok-rechnoy')!)).toEqual({ value: 400, unit: 'т' });
  });

  it('таблица цен материала: 5 строк, суммы растут с объёмом', () => {
    const rows = priceRows('pesok-rechnoy');
    expect(rows).toHaveLength(5);
    expect(rows[0].unit).toBe('bag');
    for (let i = 2; i < rows.length; i++) expect(rows[i].totalCost).toBeGreaterThan(rows[i - 1].totalCost);
  });
});
