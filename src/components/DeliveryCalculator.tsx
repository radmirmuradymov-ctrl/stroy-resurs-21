import React, { useState, useEffect, useMemo } from 'react';
import {
  MATERIALS,
  DELIVERY_ZONES,
  SITE_CONFIG,
  SERVICES,
} from '../data/siteConfig';
import { calculateDelivery, basePrice, type OrderUnit } from '../utils/calculator';
import {
  Truck,
  Calculator,
  PhoneCall,
  Send,
  CheckCircle2,
  MapPin,
  Copy,
  Check,
  Users,
  AlertCircle,
} from 'lucide-react';

interface Props {
  initialMaterialId?: string;
  initialUnit?: OrderUnit;
  initialQuantity?: number;
  initialMode?: 'material' | 'service';
  initialServiceId?: string;
}

const PRESET_BTN =
  'min-h-[44px] min-w-[44px] px-3 bg-surface-container-lowest border border-surface-variant hover:border-primary active:bg-surface-container font-label-technical text-label-technical text-on-surface';

/** Номер РФ: 10 цифр после +7 / 8 */
const phoneDigits = (v: string) => v.replace(/\D/g, '').replace(/^[78](?=\d{10}$)/, '');

export default function DeliveryCalculator({
  initialMaterialId = 'pesok-rechnoy',
  initialUnit = 'ton',
  initialQuantity = 10,
  initialMode = 'material',
  initialServiceId,
}: Props) {
  const [mode, setMode] = useState<'material' | 'service'>(initialMode);
  const [materialId, setMaterialId] = useState<string>(initialMaterialId);
  const [serviceId, setServiceId] = useState<string>(initialServiceId ?? SERVICES[0].id);
  const [unit, setUnit] = useState<OrderUnit>(initialUnit);
  const [quantity, setQuantity] = useState<number>(initialQuantity);
  const [zoneId, setZoneId] = useState<string>(DELIVERY_ZONES[0].id);
  const [needLoaders, setNeedLoaders] = useState<boolean>(false);
  const [loadersCount, setLoadersCount] = useState<number>(2);

  // Данные заявки
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [timeWindow, setTimeWindow] = useState<'morning' | 'day' | 'evening'>('morning');
  const [consent152, setConsent152] = useState(false); // 152-ФЗ: согласие только явной галочкой
  const [honeypot, setHoneypot] = useState('');

  // Статусы отправки
  // shortcut: сервера нет, «заявка» = готовый текст для мессенджера/звонка. Номер заявки не выдумываем.
  const [submitState, setSubmitState] = useState<'idle' | 'success' | 'error'>('idle');
  const phoneOk = phoneDigits(clientPhone).length === 10;
  const [copied, setCopied] = useState(false);

  // Слушаем клики по кнопкам "Заказать" в карточках каталога и услуг
  useEffect(() => {
    const handleSelect = (e: Event) => {
      const custom = e as CustomEvent<{
        type: 'material' | 'service';
        id: string;
        unit?: OrderUnit;
        qty?: number;
      }>;
      if (!custom.detail) return;
      if (custom.detail.type === 'service') {
        setMode('service');
        setServiceId(custom.detail.id);
      } else {
        setMode('material');
        setMaterialId(custom.detail.id);
        const found = MATERIALS.find((m) => m.id === custom.detail.id);
        if (custom.detail.unit) {
          setUnit(custom.detail.unit);
        } else if (found) {
          setUnit(found.defaultUnit);
          setQuantity(found.defaultUnit === 'bag' ? 20 : found.defaultUnit === 'm3' ? 5 : 10);
        }
      }
      setSubmitState('idle');
    };

    window.addEventListener('sr21:select-item', handleSelect);
    return () => window.removeEventListener('sr21:select-item', handleSelect);
  }, []);

  const calc = useMemo(
    () =>
      calculateDelivery({
        materialId,
        unit,
        quantity,
        zoneId,
        needLoaders,
        loadersCount,
        loadersHours: 2,
      }),
    [materialId, unit, quantity, zoneId, needLoaders, loadersCount]
  );

  const selectedService = useMemo(
    () => SERVICES.find((s) => s.id === serviceId) || SERVICES[0],
    [serviceId]
  );

  const selectedZone = useMemo(
    () => DELIVERY_ZONES.find((z) => z.id === zoneId) || DELIVERY_ZONES[0],
    [zoneId]
  );

  const serviceEstimatedTotal = useMemo(() => {
    const loadersExtra = needLoaders ? loadersCount * 2 * 600 : 0;
    const zoneExtra =
      zoneId === 'novocheboksarsk' ? 800 : zoneId === 'rayon' ? 2000 : 0;
    return selectedService.priceFrom + loadersExtra + zoneExtra;
  }, [selectedService, needLoaders, loadersCount, zoneId]);

  const timeWindowLabel =
    timeWindow === 'morning'
      ? 'Утро (07:00–12:00)'
      : timeWindow === 'day'
      ? 'День (12:00–16:00)'
      : 'Вечер (16:00–20:00)';

  const fullOrderText = useMemo(() => {
    const header = 'Заявка с сайта Строй Ресурс 21';
    const contactLine =
      (clientName ? `\n• Клиент: ${clientName}` : '') +
      (clientPhone ? `\n• Телефон: ${clientPhone}` : '') +
      (addressDetail ? `\n• Точный адрес: ${addressDetail}` : '') +
      `\n• Желаемое окно: ${timeWindowLabel}`;

    if (mode === 'service') {
      return (
        `${header}\n` +
        `• Услуга: ${selectedService.name}\n` +
        `• Район: ${selectedZone.name}\n` +
        `• Грузчики: ${needLoaders ? `Да (${loadersCount} чел.)` : 'Не требуются'}\n` +
        `• Ориентир по стоимости: от ${serviceEstimatedTotal.toLocaleString('ru-RU')} ₽` +
        contactLine
      );
    }

    return `${ calc.summaryText }${ contactLine }`;
  }, [
    clientName,
    clientPhone,
    addressDetail,
    timeWindowLabel,
    mode,
    selectedService,
    selectedZone,
    needLoaders,
    loadersCount,
    serviceEstimatedTotal,
    calc.summaryText,
  ]);

  const handleUnitChange = (newUnit: OrderUnit) => {
    setUnit(newUnit);
    if (newUnit === 'bag') setQuantity(20);
    else if (newUnit === 'm3') setQuantity(6);
    else setQuantity(10);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return; // антиспам
    setSubmitState(consent152 && phoneOk ? 'success' : 'error');
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(fullOrderText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  const whatsappOrderHref = `${SITE_CONFIG.socials.whatsappUrl}?text=${encodeURIComponent(fullOrderText)}`;

  return (
    <div className="bg-surface-container border-2 border-primary p-4 sm:p-6 lg:p-8 relative">
      {/* Верхняя техническая плашка */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-surface-variant">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-secondary-container" aria-hidden="true" />
            <span className="font-label-technical text-label-technical uppercase tracking-widest text-secondary font-bold">
              Быстрый расчёт доставки и подбор машины
            </span>
          </div>
          <h2 className="font-headline-lg text-headline-xl-mobile md:text-headline-lg uppercase font-bold text-primary mt-1">
            Калькулятор заказа по Чебоксарам и Чувашии
          </h2>
        </div>

        {/* Переключатель: Материалы / Услуги */}
        <div
          className="inline-flex p-1 bg-surface-container-lowest border border-surface-variant"
          role="group"
          aria-label="Тип расчёта"
        >
          <button
            type="button"
            aria-pressed={mode === 'material'}
            onClick={() => {
              setMode('material');
              setSubmitState('idle');
            }}
            className={`min-h-[44px] px-4 py-2 font-label-technical text-label-technical uppercase tracking-wider font-bold transition-colors ${
              mode === 'material'
                ? 'bg-primary text-on-primary'
                : 'bg-transparent text-on-surface hover:bg-surface-container'
            }`}
          >
            Привезти материал
          </button>
          <button
            type="button"
            aria-pressed={mode === 'service'}
            onClick={() => {
              setMode('service');
              setSubmitState('idle');
            }}
            className={`min-h-[44px] px-4 py-2 font-label-technical text-label-technical uppercase tracking-wider font-bold transition-colors ${
              mode === 'service'
                ? 'bg-primary text-on-primary'
                : 'bg-transparent text-on-surface hover:bg-surface-container'
            }`}
          >
            Вывоз мусора / Техника
          </button>
        </div>
      </div>

      {/* Поля калькулятора */}
      {mode === 'material' ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6">
          {/* 1. Выбор материала */}
          <div className="md:col-span-5 flex flex-col gap-1.5">
            <label
              htmlFor="calc-material-select"
              className="font-label-md text-label-md text-on-surface uppercase font-bold"
            >
              Материал <span className="text-secondary-container">*</span>
            </label>
            <select
              id="calc-material-select"
              value={materialId}
              onChange={(e) => {
                const nextId = e.target.value;
                setMaterialId(nextId);
                const mat = MATERIALS.find((m) => m.id === nextId);
                if (mat) handleUnitChange(mat.defaultUnit);
              }}
              className="min-h-[48px] w-full bg-surface-container-lowest border-2 border-outline focus:border-primary px-3 py-2.5 font-body-md text-body-md text-on-surface font-medium rounded-sm"
            >
              <optgroup label="Для стройки">
                {MATERIALS.filter((m) => m.category === 'stroyka').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.shortName} — от {basePrice(m).value} ₽/{basePrice(m).unit} ({m.pricePerBag} ₽/мешок)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Для сада и огорода">
                {MATERIALS.filter((m) => m.category === 'sad').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.shortName} — от {basePrice(m).value} ₽/{basePrice(m).unit} ({m.pricePerBag} ₽/мешок)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Для печи и бани">
                {MATERIALS.filter((m) => m.category === 'pech').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.shortName} — от {basePrice(m).value} ₽/{basePrice(m).unit} ({m.pricePerBag} ₽/мешок)
                  </option>
                ))}
              </optgroup>
            </select>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Насыпная плотность: ~{calc.material.bulkDensity} т/м³ • Мешок: {calc.material.bagWeightKg} кг
            </span>
          </div>

          {/* 2. Единица и количество */}
          <div className="md:col-span-4 flex flex-col gap-1.5">
            <span className="font-label-md text-label-md text-on-surface uppercase font-bold">
              Объём (мешки / тонны / м³) <span className="text-secondary-container">*</span>
            </span>
            <div className="flex gap-1">
              <div className="inline-flex border-2 border-outline bg-surface-container-lowest shrink-0">
                {(['ton', 'm3', 'bag'] as OrderUnit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={unit === u}
                    onClick={() => handleUnitChange(u)}
                    className={`min-h-[44px] px-2.5 font-label-technical text-label-technical uppercase font-bold transition-colors ${
                      unit === u
                        ? 'bg-primary text-on-primary'
                        : 'text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    {u === 'ton' ? 'Тонны' : u === 'm3' ? 'м³' : 'Мешки'}
                  </button>
                ))}
              </div>
              <input
                type="number"
                inputMode="decimal"
                aria-label={`Количество, ${unit === 'ton' ? 'тонн' : unit === 'm3' ? 'кубометров' : 'мешков'}`}
                min={unit === 'bag' ? 5 : 0.5}
                max={300}
                step={unit === 'bag' ? 5 : 0.5}
                value={Number.isNaN(quantity) ? '' : quantity}
                onChange={(e) => setQuantity(e.target.valueAsNumber)}
                className="min-h-[48px] w-full bg-surface-container-lowest border-2 border-outline focus:border-primary px-3 font-tabular-price text-headline-md text-primary tabular-nums rounded-sm"
              />
            </div>
            {/* Быстрые пресеты объёма */}
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {unit === 'bag'
                ? [10, 20, 40, 60].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setQuantity(val)}
                      className={PRESET_BTN}
                    >
                      {val} мешк.
                    </button>
                  ))
                : unit === 'm3'
                ? [3, 5, 10, 15].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setQuantity(val)}
                      className={PRESET_BTN}
                    >
                      {val} м³
                    </button>
                  ))
                : [1, 5, 10, 15, 20].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setQuantity(val)}
                      className={PRESET_BTN}
                    >
                      {val} т
                    </button>
                  ))}
            </div>
          </div>

          {/* Зона доставки */}
          <div className="md:col-span-3 flex flex-col gap-1.5">
            <label
              htmlFor="calc-zone-select"
              className="font-label-md text-label-md text-on-surface uppercase font-bold"
            >
              Зона доставки <span className="text-secondary-container">*</span>
            </label>
            <select
              id="calc-zone-select"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="min-h-[48px] w-full bg-surface-container-lowest border-2 border-outline focus:border-primary px-3 py-2.5 font-body-md text-body-md text-on-surface font-medium rounded-sm"
            >
              {DELIVERY_ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {selectedZone.areas}
            </span>
          </div>
        </div>
      ) : (
        /* Режим расчёта услуги (Вывоз мусора / Манипулятор / Самосвал / Грузчики) */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6">
          <div className="md:col-span-6 flex flex-col gap-1.5">
            <label
              htmlFor="calc-service-select"
              className="font-label-md text-label-md text-on-surface uppercase font-bold"
            >
              Услуга или техника <span className="text-secondary-container">*</span>
            </label>
            <select
              id="calc-service-select"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="min-h-[48px] w-full bg-surface-container-lowest border-2 border-outline focus:border-primary px-3 py-2.5 font-body-md text-body-md text-on-surface font-medium rounded-sm"
            >
              {SERVICES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — от {s.priceFrom.toLocaleString('ru-RU')} ₽/{s.unitLabel}
                </option>
              ))}
            </select>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {selectedService.badge}
            </span>
          </div>

          <div className="md:col-span-6 flex flex-col gap-1.5">
            <label
              htmlFor="calc-service-zone"
              className="font-label-md text-label-md text-on-surface uppercase font-bold"
            >
              Район подачи машины <span className="text-secondary-container">*</span>
            </label>
            <select
              id="calc-service-zone"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="min-h-[48px] w-full bg-surface-container-lowest border-2 border-outline focus:border-primary px-3 py-2.5 font-body-md text-body-md text-on-surface font-medium rounded-sm"
            >
              {DELIVERY_ZONES.filter((z) => z.id !== 'pickup').map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.areas})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Дополнительная опция: Грузчики */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-5 border-b border-surface-variant">
        <label className="inline-flex items-center gap-3 cursor-pointer select-none min-h-[44px]">
          <input
            type="checkbox"
            checked={needLoaders}
            onChange={(e) => setNeedLoaders(e.target.checked)}
            className="w-5 h-5 accent-primary rounded-sm shrink-0"
          />
          <span className="font-body-md text-body-md font-semibold text-on-surface flex items-center gap-1.5">
            <Users className="w-4 h-4 text-primary" aria-hidden="true" />
            Нужны грузчики для разгрузки / выноса мусора (от 600 ₽/час)
          </span>
        </label>

        {needLoaders && (
          <div className="flex items-center gap-2">
            <span className="font-label-technical text-label-technical uppercase text-on-surface-variant">
              Человек в бригаде:
            </span>
            {[1, 2, 3, 4].map((cnt) => (
              <button
                key={cnt}
                type="button"
                aria-pressed={loadersCount === cnt}
                aria-label={`${cnt} чел.`}
                onClick={() => setLoadersCount(cnt)}
                className={`min-w-[44px] min-h-[44px] px-2.5 font-label-md text-label-md font-bold border tabular-nums ${
                  loadersCount === cnt
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-lowest text-on-surface border-outline hover:border-primary'
                }`}
              >
                {cnt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Табло результата расчёта */}
      <div className="bg-surface-container-lowest border-2 border-primary p-4 sm:p-5 mb-6" aria-live="polite">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* 1. Примерная стоимость */}
          <div className="flex flex-col">
            <span className="font-label-technical text-label-technical uppercase text-on-surface-variant">
              Примерная сумма с доставкой
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-tabular-price text-headline-xl text-secondary-container font-bold tabular-nums">
                ~{(mode === 'material' ? calc.totalCost : serviceEstimatedTotal).toLocaleString('ru-RU')} ₽
              </span>
              {SITE_CONFIG.isDemoPrices && (
                <span className="font-label-technical text-label-technical bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 uppercase">
                  Прайс на уточнении
                </span>
              )}
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              {mode === 'material'
                ? `Материал: ${calc.materialCost.toLocaleString('ru-RU')} ₽ + Доставка: ${calc.deliveryCost.toLocaleString('ru-RU')} ₽${
                    calc.loadersCost ? ` + Грузчики: ${calc.loadersCost.toLocaleString('ru-RU')} ₽` : ''
                  }`
                : 'Точную цену назовём по телефону'}
            </span>
          </div>

          {/* 2. Подходящая машина */}
          <div className="flex flex-col md:border-l border-surface-variant md:pl-4">
            <span className="font-label-technical text-label-technical uppercase text-on-surface-variant flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              Подходящая машина
            </span>
            <span className="font-headline-sm text-headline-sm text-primary uppercase font-bold mt-1">
              {mode === 'material' ? calc.recommendedVehicle : selectedService.shortName}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              {mode === 'material' ? (
                <>
                  Пересчёт веса: <strong>{calc.estimatedTons} т</strong> ≈{' '}
                  <strong>{calc.estimatedM3} м³</strong> ({calc.estimatedBags} мешк.)
                </>
              ) : (
                selectedService.badge
              )}
            </span>
          </div>

          {/* 3. Срок подачи */}
          <div className="flex flex-col md:border-l border-surface-variant md:pl-4">
            <span className="font-label-technical text-label-technical uppercase text-on-surface-variant flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-secondary-container" aria-hidden="true" />
              Срок подачи и оплата
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface uppercase font-bold mt-1">
              {selectedZone.etaLabel}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant font-semibold mt-0.5">
              Оплата по факту доставки / выполнения
            </span>
          </div>
        </div>
      </div>

      {/* Форма отправки или экран подтверждения */}
      {submitState === 'success' ? (
        <div
          className="bg-surface-container-lowest border-2 border-tertiary p-5 sm:p-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-variant">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-7 h-7 text-tertiary shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-label-technical text-label-technical uppercase bg-tertiary text-on-tertiary px-2 py-0.5">
                  Расчёт готов, но ещё не отправлен
                </span>
                <h3 className="font-headline-md text-headline-md uppercase text-primary mt-1">
                  Отправьте нам заявку
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
                  Сайт сам заявку не пересылает. Отправьте текст в WhatsApp, Telegram или ВКонтакте либо позвоните — подтвердим машину, время и сумму.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSubmitState('idle')}
              className="min-h-[44px] px-4 py-2 border border-outline text-on-surface font-label-technical text-label-technical uppercase hover:bg-surface-container active:bg-surface-variant shrink-0"
            >
              Изменить расчёт
            </button>
          </div>

          <pre className="bg-surface p-3 my-4 font-mono text-body-sm text-on-surface whitespace-pre-wrap border border-surface-variant">
            {fullOrderText}
          </pre>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={whatsappOrderHref}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[48px] inline-flex items-center justify-center gap-2 bg-tertiary hover:bg-tertiary-container active:translate-y-px text-on-tertiary px-5 py-3 font-label-lg text-label-lg uppercase font-bold tracking-wider"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              Отправить в WhatsApp
            </a>
            <a
              href={SITE_CONFIG.socials.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[48px] inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-on-primary px-5 py-3 font-label-lg text-label-lg uppercase font-bold tracking-wider"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              Написать в Telegram
            </a>
            <a
              href={SITE_CONFIG.socials.vkGroup}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[48px] inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-on-primary px-5 py-3 font-label-lg text-label-lg uppercase font-bold tracking-wider"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              Написать во ВКонтакте
            </a>
            <button
              type="button"
              onClick={handleCopyText}
              aria-live="polite"
              className="min-h-[48px] inline-flex items-center justify-center gap-2 bg-surface-container-lowest border-2 border-primary text-primary hover:bg-surface px-4 py-3 font-label-lg text-label-lg uppercase font-bold"
            >
              {copied ? <Check className="w-4 h-4 text-tertiary" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
              {copied ? 'Текст скопирован' : 'Скопировать расчёт'}
            </button>
            <a
              href={`tel:${SITE_CONFIG.phones.mainRaw}`}
              className="min-h-[48px] inline-flex items-center justify-center gap-2 bg-secondary-container hover:bg-secondary-hover active:translate-y-px text-on-secondary px-5 py-3 font-label-lg text-label-lg uppercase font-bold tabular-nums"
            >
              <PhoneCall className="w-4 h-4" aria-hidden="true" />
              Позвонить {SITE_CONFIG.phones.main}
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {/* Honeypot от спам-ботов */}
          <div className="hidden" aria-hidden="true">
            <label>
              Не заполняйте это поле
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="order-address"
                className="block font-label-md text-label-md text-on-surface uppercase font-bold mb-1"
              >
                Улица / СНТ / деревня
              </label>
              <input
                id="order-address"
                type="text"
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                placeholder="Напр.: с. Загорское, ул. Гагарина 24"
                className="min-h-[48px] w-full bg-surface-container-lowest border border-outline focus:border-primary px-3 py-2 font-body-md text-body-md text-on-surface rounded-sm"
              />
            </div>

            <div>
              <label
                htmlFor="order-window"
                className="block font-label-md text-label-md text-on-surface uppercase font-bold mb-1"
              >
                Когда удобно принять
              </label>
              <select
                id="order-window"
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value as 'morning' | 'day' | 'evening')}
                className="min-h-[48px] w-full bg-surface-container-lowest border border-outline focus:border-primary px-3 py-2 font-body-md text-body-md text-on-surface rounded-sm"
              >
                <option value="morning">Сегодня / Утро (07:00–12:00)</option>
                <option value="day">Сегодня / День (12:00–16:00)</option>
                <option value="evening">Сегодня / Вечер (16:00–20:00)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="order-name"
                className="block font-label-md text-label-md text-on-surface uppercase font-bold mb-1"
              >
                Ваше имя
              </label>
              <input
                id="order-name"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Как к вам обращаться"
                className="min-h-[48px] w-full bg-surface-container-lowest border border-outline focus:border-primary px-3 py-2 font-body-md text-body-md text-on-surface rounded-sm"
              />
            </div>

            <div>
              <label
                htmlFor="order-phone"
                className="block font-label-md text-label-md text-on-surface uppercase font-bold mb-1"
              >
                Ваш телефон <span className="text-secondary-container">*</span>
              </label>
              <input
                id="order-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                aria-invalid={submitState === 'error' && !phoneOk}
                aria-describedby={submitState === 'error' ? 'order-error' : undefined}
                value={clientPhone}
                onChange={(e) => {
                  setClientPhone(e.target.value);
                  if (submitState === 'error') setSubmitState('idle');
                }}
                placeholder="+7 (9__) ___-__-__"
                className="min-h-[48px] w-full bg-surface-container-lowest border-2 border-outline focus:border-primary aria-[invalid=true]:border-error px-3 py-2 font-body-md text-body-md text-on-surface tabular-nums rounded-sm"
              />
            </div>
          </div>

          {submitState === 'error' && (
            <div
              id="order-error"
              className="flex items-center gap-2 text-on-error-container font-body-sm text-body-sm bg-error-container px-3 py-2 border border-error"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {!phoneOk
                  ? 'Проверьте телефон: нужно 10 цифр после +7, например +7 960 306-11-97.'
                  : 'Поставьте галочку согласия на обработку данных — без неё мы не можем принять заявку.'}
              </span>
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2">
            <label className="inline-flex items-start gap-3 cursor-pointer select-none min-h-[44px] py-1">
              <input
                type="checkbox"
                checked={consent152}
                onChange={(e) => {
                  setConsent152(e.target.checked);
                  if (submitState === 'error') setSubmitState('idle');
                }}
                className="w-5 h-5 mt-0.5 accent-primary shrink-0"
              />
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Согласен на обработку персональных данных
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="min-h-[48px] px-6 py-3 bg-secondary-container hover:bg-secondary-hover active:translate-y-px text-on-secondary font-label-lg text-label-lg uppercase font-bold tracking-wider transition-colors"
              >
                Проверить и отправить
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
