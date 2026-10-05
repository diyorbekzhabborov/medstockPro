// Shared seed data matching the specifications in the TOR
module.exports = {
  products: [
    {
      id: 'prod-001',
      name: 'Шприц 5мл одноразовый с иглой 0.7x40mm',
      sku: 'MED-SHP-005',
      barcode: '4820010050012',
      category: 'Расходные материалы',
      unit: 'шт.',
      stock_quantity: 9875, // initially 10,000, reduced by transactions
      retail_price: 1.00,
      photo_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=60'
    },
    {
      id: 'prod-002',
      name: 'Капельницы инфузионные (система инфузионная ПР 21-01)',
      sku: 'MED-INF-021',
      barcode: '4820010050029',
      category: 'Расходные материалы',
      unit: 'шт.',
      stock_quantity: 1175,
      retail_price: 4.50,
      photo_url: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300&auto=format&fit=crop&q=60'
    },
    {
      id: 'prod-003',
      name: 'Физраствор 200мл (Натрия хлорид 0.9% флакон)',
      sku: 'MED-NACL-200',
      barcode: '4820010050036',
      category: 'Растворы',
      unit: 'флакон',
      stock_quantity: 750,
      retail_price: 7.00,
      photo_url: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=300&auto=format&fit=crop&q=60'
    },
    {
      id: 'prod-004',
      name: 'Цефтриаксон 1.0г флакон (порошок д/инъекций)',
      sku: 'MED-CEF-100',
      barcode: '4820010050043',
      category: 'Антибиотики',
      unit: 'флакон',
      stock_quantity: 540,
      retail_price: 12.50,
      photo_url: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=300&auto=format&fit=crop&q=60'
    },
    {
      id: 'prod-005',
      name: 'Перчатки нитриловые неопудренные (размер M)',
      sku: 'MED-GLV-002',
      barcode: '4820010050050',
      category: 'Защитные средства',
      unit: 'уп. (50 пар)',
      stock_quantity: 320,
      retail_price: 65.00,
      photo_url: 'https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=300&auto=format&fit=crop&q=60'
    },
    {
      id: 'prod-006',
      name: 'Спирт медицинский 96% 100мл флакон',
      sku: 'MED-ALC-096',
      barcode: '4820010050067',
      category: 'Антисептики',
      unit: 'флакон',
      stock_quantity: 430,
      retail_price: 6.00,
      photo_url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=300&auto=format&fit=crop&q=60'
    },
    {
      id: 'prod-007',
      name: 'Бинт марлевый медицинский стерильный 7м х 14см',
      sku: 'MED-BND-714',
      barcode: '4820010050074',
      category: 'Перевязочные',
      unit: 'шт.',
      stock_quantity: 1400,
      retail_price: 3.20,
      photo_url: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=300&auto=format&fit=crop&q=60'
    },
    {
      id: 'prod-008',
      name: 'Ампулы Дротаверин (Но-Шпа) 20мг/мл 2мл №5',
      sku: 'MED-DRO-002',
      barcode: '4820010050081',
      category: 'Спазмолитики',
      unit: 'уп.',
      stock_quantity: 260,
      retail_price: 24.00,
      photo_url: 'https://images.unsplash.com/photo-1550572017-ed21b0b57e79?w=300&auto=format&fit=crop&q=60'
    }
  ],

  initialOperations: [
    {
      id: 'op-1042',
      operation_code: '1042',
      type: 'SALE',
      payment_type: 'BANK_TRANSFER',
      bank_name: 'Dushanbe City (DC)',
      transaction_reference: 'DC-8849102',
      total_amount: 100.00,
      counterparty_name: 'Покупатель розничный (DC)',
      counterparty_phone: '',
      status: 'PAID',
      notes: 'Оплата через QR Dushanbe City',
      created_by: 'Заведующий складом',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      items: [
        { product_id: 'prod-001', product_name: 'Шприцы 5мл', quantity: 100, unit_price: 1.00, total_price: 100.00 }
      ]
    },
    {
      id: 'op-1043',
      operation_code: '1043',
      type: 'CLINIC_WRITE_OFF',
      payment_type: 'NONE',
      bank_name: null,
      transaction_reference: 'REQ-CLN-041',
      total_amount: 0.00,
      counterparty_name: 'Стационарное отделение (Клиника)',
      counterparty_phone: '',
      status: 'CLINIC_INTERNAL',
      notes: 'Процедурный кабинет 2 этаж. Внутренний расход клиники.',
      created_by: 'Фармацевт/Оператор',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      items: [
        { product_id: 'prod-002', product_name: 'Капельницы инфуз.', quantity: 25, unit_price: 4.50, total_price: 112.50 }
      ]
    },
    {
      id: 'op-1044',
      operation_code: '1044',
      type: 'SALE',
      payment_type: 'DEBT',
      bank_name: null,
      transaction_reference: '',
      total_amount: 350.00,
      counterparty_name: 'Аптека «Шифо»',
      counterparty_phone: '+992927774422',
      due_date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      status: 'DEBT',
      notes: 'Отпуск под реализацию на 7 дней',
      created_by: 'Заведующий складом',
      created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
      items: [
        { product_id: 'prod-003', product_name: 'Физраствор 200мл', quantity: 50, unit_price: 7.00, total_price: 350.00 }
      ]
    }
  ],

  initialDebts: [
    {
      id: 'debt-001',
      operation_id: 'op-1044',
      debtor_name: 'Аптека «Шифо»',
      phone: '+992927774422',
      initial_amount: 350.00,
      remaining_amount: 350.00,
      issue_date: new Date(Date.now() - 3600000 * 1).toISOString(),
      due_date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      status: 'ACTIVE',
      items_summary: 'Физраствор 200мл (50 шт.)'
    },
    {
      id: 'debt-002',
      operation_id: 'op-1030',
      debtor_name: 'Клиника «Шифобахш»',
      phone: '+992901234567',
      initial_amount: 1200.00,
      remaining_amount: 800.00,
      issue_date: new Date(Date.now() - 86400000 * 5).toISOString(),
      due_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      status: 'PARTIALLY_PAID',
      items_summary: 'Цефтриаксон (60 шт.), Перчатки (10 уп.)'
    },
    {
      id: 'debt-003',
      operation_id: 'op-1015',
      debtor_name: 'Доктор Каримов Ф.Х.',
      phone: '+992935558899',
      initial_amount: 480.00,
      remaining_amount: 480.00,
      issue_date: new Date(Date.now() - 86400000 * 8).toISOString(),
      due_date: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
      status: 'OVERDUE',
      items_summary: 'Но-Шпа (15 уп.), Шприцы (120 шт.)'
    }
  ],

  initialUsers: [
    {
      id: 'user-1',
      username: 'owner',
      password: '123',
      fullName: 'Абдулло (Собственник)',
      role: 'OWNER'
    },
    {
      id: 'user-2',
      username: 'manager',
      password: '123',
      fullName: 'Рахим (Заведующий складом)',
      role: 'MANAGER'
    },
    {
      id: 'user-3',
      username: 'operator',
      password: '123',
      fullName: 'Нигина (Фармацевт/Оператор)',
      role: 'OPERATOR'
    }
  ]
};
