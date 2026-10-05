// Shared constants for MedStock Pro
module.exports = {
  CURRENCY: 'TJS',
  CURRENCY_SYMBOL: 'TJS',

  ROLES: {
    OWNER: 'Владелец',
    MANAGER: 'Заведующий складом',
    OPERATOR: 'Фармацевт/Оператор'
  },

  BANKS: [
    { id: 'dc', name: 'Dushanbe City (DC)', shortName: 'DC', color: '#EC4899', icon: 'smartphone' },
    { id: 'eskhata', name: 'Банк Эсхата', shortName: 'Эсхата', color: '#2563EB', icon: 'credit-card' },
    { id: 'alif', name: 'Алиф Банк / Alif Mobi', shortName: 'Alif', color: '#10B981', icon: 'wallet' },
    { id: 'amonat', name: 'Амонатбонк / Другой банк', shortName: 'Амонат', color: '#059669', icon: 'building' }
  ],

  PAYMENT_TYPES: {
    CASH: { id: 'CASH', label: 'Наличный расчёт (Касса склада)', description: 'Деньги попадают в счёт наличной кассы' },
    BANK_TRANSFER: { id: 'BANK_TRANSFER', label: 'Безналичный перевод', description: 'Зачисление на счёт банка РТ' },
    DEBT: { id: 'DEBT', label: 'В долг (Под реализацию)', description: 'Зачисление в реестр дебиторской задолженности' },
    NONE: { id: 'NONE', label: 'Без оплаты (Внутренний расход клиники)', description: 'Сумма 0.00 TJS, не формирует долг и выручку' }
  },

  OPERATION_TYPES: {
    SALE: 'Продажа клиенту',
    CLINIC_WRITE_OFF: 'Списание в частную клинику',
    RECEIVE: 'Оприходование на склад',
    ADJUSTMENT: 'Инвентаризация / Корректировка'
  },

  OPERATION_STATUSES: {
    PAID: 'Оплачено',
    DEBT: 'В долг (Дебиторка)',
    CLINIC_INTERNAL: 'Использование в клинике (Внутр. расход)',
    RECEIVED: 'Оприходовано'
  }
};
