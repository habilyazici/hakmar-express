import type { ResourceDef } from './resource-types';

/**
 * One declaration per entity, mirroring the API's DTOs.
 *
 * Unlike the backend — where a generated CRUD layer would have risked the
 * ValidationPipe losing sight of the DTO and silently accepting anything —
 * driving the UI from a table is safe: the server validates every write
 * regardless of what this file says, so the worst a mistake here can cause
 * is a 400 the form then displays.
 */
export const RESOURCES: ResourceDef[] = [
  {
    key: 'categories',
    title: 'Kategoriler',
    noun: 'kategori',
    endpoint: '/catalog/categories',
    idField: 'id',
    columns: [
      { key: 'id', label: '#', align: 'right' },
      { key: 'name', label: 'Ad' },
    ],
    fields: [{ name: 'name', label: 'Ad', type: 'text', required: true }],
  },
  {
    key: 'subcategories',
    title: 'Alt Kategoriler',
    noun: 'alt kategori',
    endpoint: '/catalog/subcategories',
    idField: 'id',
    columns: [
      { key: 'id', label: '#', align: 'right' },
      { key: 'name', label: 'Ad' },
      { key: 'category.name', label: 'Kategori' },
    ],
    fields: [
      { name: 'name', label: 'Ad', type: 'text', required: true },
      {
        name: 'categoryId',
        label: 'Kategori',
        type: 'reference',
        required: true,
        reference: {
          endpoint: '/catalog/categories',
          valueKey: 'id',
          labelKey: 'name',
        },
      },
    ],
    emptyHint: 'Önce bir kategori oluşturun.',
  },
  {
    key: 'brands',
    title: 'Markalar',
    noun: 'marka',
    endpoint: '/catalog/brands',
    idField: 'code',
    columns: [
      { key: 'code', label: 'Kod' },
      { key: 'name', label: 'Ad' },
      { key: 'category.name', label: 'Kategori' },
    ],
    fields: [
      {
        name: 'code',
        label: 'Kod',
        type: 'text',
        required: true,
        createOnly: true,
        hint: '2-16 büyük harf veya rakam. Sonradan değiştirilemez.',
      },
      { name: 'name', label: 'Ad', type: 'text', required: true },
      {
        name: 'categoryId',
        label: 'Kategori',
        type: 'reference',
        required: true,
        reference: {
          endpoint: '/catalog/categories',
          valueKey: 'id',
          labelKey: 'name',
        },
      },
    ],
    emptyHint: 'Önce bir kategori oluşturun.',
  },
  {
    key: 'products',
    title: 'Ürünler',
    noun: 'ürün',
    endpoint: '/catalog/products',
    idField: 'id',
    columns: [
      { key: 'id', label: '#', align: 'right' },
      { key: 'name', label: 'Ad' },
      { key: 'brand.name', label: 'Marka' },
      { key: 'subcategory.name', label: 'Alt kategori' },
    ],
    fields: [
      { name: 'name', label: 'Ad', type: 'text', required: true },
      {
        name: 'brandCode',
        label: 'Marka',
        type: 'reference',
        required: true,
        reference: {
          endpoint: '/catalog/brands',
          valueKey: 'code',
          labelKey: 'name',
        },
      },
      {
        name: 'subcategoryId',
        label: 'Alt kategori',
        type: 'reference',
        required: true,
        reference: {
          endpoint: '/catalog/subcategories',
          valueKey: 'id',
          labelKey: 'name',
        },
      },
    ],
    emptyHint: 'Önce marka ve alt kategori oluşturun.',
  },
  {
    key: 'regions',
    title: 'Bölgeler',
    noun: 'bölge',
    endpoint: '/geo/regions',
    idField: 'id',
    columns: [
      { key: 'id', label: '#', align: 'right' },
      { key: 'name', label: 'Ad' },
    ],
    fields: [{ name: 'name', label: 'Ad', type: 'text', required: true }],
  },
  {
    key: 'cities',
    title: 'Şehirler',
    noun: 'şehir',
    endpoint: '/geo/cities',
    idField: 'id',
    columns: [
      { key: 'id', label: '#', align: 'right' },
      { key: 'name', label: 'Ad' },
      { key: 'plateCode', label: 'Plaka', align: 'right' },
      { key: 'region.name', label: 'Bölge' },
    ],
    fields: [
      { name: 'name', label: 'Ad', type: 'text', required: true },
      {
        name: 'plateCode',
        label: 'Plaka kodu',
        type: 'number',
        required: true,
        hint: '1-81. Haritayı bu kod üzerinden eşleştiriyoruz.',
      },
      {
        name: 'regionId',
        label: 'Bölge',
        type: 'reference',
        required: true,
        reference: { endpoint: '/geo/regions', valueKey: 'id', labelKey: 'name' },
      },
    ],
    emptyHint: 'Önce bir bölge oluşturun.',
  },
  {
    key: 'branches',
    title: 'Şubeler',
    noun: 'şube',
    endpoint: '/geo/branches',
    idField: 'id',
    columns: [
      { key: 'id', label: '#', align: 'right' },
      { key: 'name', label: 'Ad' },
      { key: 'city.name', label: 'Şehir' },
      { key: 'latitude', label: 'Enlem', align: 'right' },
      { key: 'longitude', label: 'Boylam', align: 'right' },
    ],
    fields: [
      { name: 'name', label: 'Ad', type: 'text', required: true },
      {
        name: 'cityId',
        label: 'Şehir',
        type: 'reference',
        required: true,
        reference: { endpoint: '/geo/cities', valueKey: 'id', labelKey: 'name' },
      },
      {
        name: 'latitude',
        label: 'Enlem',
        type: 'number',
        hint: 'Coğrafi satış haritasında kullanılır.',
      },
      { name: 'longitude', label: 'Boylam', type: 'number' },
    ],
    emptyHint: 'Önce bir şehir oluşturun.',
  },
  {
    key: 'customers',
    title: 'Müşteriler',
    noun: 'müşteri',
    endpoint: '/people/customers',
    idField: 'id',
    columns: [
      { key: 'id', label: '#', align: 'right' },
      { key: 'firstName', label: 'Ad' },
      { key: 'lastName', label: 'Soyad' },
      { key: 'gender', label: 'Cinsiyet' },
    ],
    fields: [
      { name: 'firstName', label: 'Ad', type: 'text', required: true },
      { name: 'lastName', label: 'Soyad', type: 'text', required: true },
      {
        name: 'gender',
        label: 'Cinsiyet',
        type: 'select',
        options: [
          { value: '', label: 'Belirtilmemiş' },
          { value: 'F', label: 'Kadın' },
          { value: 'M', label: 'Erkek' },
          { value: 'O', label: 'Diğer' },
        ],
      },
    ],
  },
  {
    key: 'cashiers',
    title: 'Kasiyerler',
    noun: 'kasiyer',
    endpoint: '/people/cashiers',
    idField: 'id',
    columns: [
      { key: 'id', label: '#', align: 'right' },
      { key: 'firstName', label: 'Ad' },
      { key: 'lastName', label: 'Soyad' },
      { key: 'branch.name', label: 'Şube' },
    ],
    fields: [
      { name: 'firstName', label: 'Ad', type: 'text', required: true },
      { name: 'lastName', label: 'Soyad', type: 'text', required: true },
      {
        name: 'branchId',
        label: 'Şube',
        type: 'reference',
        required: true,
        reference: {
          endpoint: '/geo/branches',
          valueKey: 'id',
          labelKey: 'name',
        },
      },
    ],
    emptyHint: 'Önce bir şube oluşturun.',
  },
];
