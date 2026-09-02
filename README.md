# Hakmar Express

Hakmar Express perakende analitik panelinin sıfırdan yeniden yazımı. Eski
Express / Sequelize / MySQL uygulamasının yerini alır.

- **API** — NestJS + Prisma + PostgreSQL
- **Web** — React + Vite + TanStack Query
- **Önbellek** — Redis (`@keyv/redis`)
- **Monorepo** — pnpm workspaces + Turborepo

---

## İçindekiler

- [Kurulum](#kurulum)
- [Portlar](#portlar)
- [Komutlar](#komutlar)
- [Mimari](#mimari)
- [API](#api)
- [Güvenlik](#güvenlik)
- [Gözlemlenebilirlik](#gözlemlenebilirlik)
- [Dağıtım](#dağıtım)
- [Durum](#durum)

---

## Kurulum

**Gerekenler:** Node 24, pnpm (`corepack enable`), Docker Desktop.

```bash
docker compose up -d                          # postgres :5433, redis :6380
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# apps/api/.env içindeki JWT_ACCESS_SECRET'ı gerçek bir değerle değiştirin:
#   openssl rand -hex 32
pnpm --filter api exec prisma migrate dev     # şemayı oluşturur
pnpm --filter api exec prisma db seed         # ilk superadmin + il sınırları
pnpm dev                                      # api :3001, web :5174
```

Ardından **http://localhost:5174** adresine gidin.

### İlk hesap

Seed, `apps/api/.env` içindeki `SEED_ADMIN_USERNAME` ve `SEED_ADMIN_PASSWORD`
değerlerinden ilk süper yöneticiyi oluşturur. `.env.example`'dan olduğu gibi
kopyalandığında bunlar `superadmin` / `ChangeMe123!` olur — yalnızca geliştirme
içindir, hemen değiştirin.

Değerleri değiştirip seed'i yeniden çalıştırmak mevcut hesabı **sıfırlamaz**:
upsert ona dokunmaz. Şifreyi uygulama üzerinden değiştirin ya da önce satırı
silin.

`JWT_ACCESS_SECRET` en az 32 karakter olmalı. Uygulama tüm ortamını açılışta
doğrular ve eksik ya da hatalı değişkeni **adıyla söyleyerek** başlamayı
reddeder.

### Örnek veri

Boş bir veritabanını kurgusal bir satış geçmişiyle doldurmak için — 17 şube,
25 ürün, 25 ay boyunca ~2.500 fiş; her sayfanın gerçek bir şey göstermesine
yetecek kadar:

```bash
pnpm --filter api seed:demo            # veri varsa reddeder
pnpm --filter api seed:demo -- --force # siler ve yeniden üretir
```

---

## Portlar

Buradaki hiçbir servis, kendi ekosisteminin kapıştığı varsayılan portta
oturmuyor. Böylece bu proje, açık olan başka ne varsa onun yanında çalışır.

| | varsayılan | burada |
| --- | --- | --- |
| Postgres | 5432 | **5433** |
| Redis | 6379 | **6380** |
| API | 3000 | **3001** |
| Web | 5173 | **5174** |

Bu bir titizlik meselesi değil: varsayılanların her biri, port sorunu gibi
*görünmeyen* bir şekilde başarısız oluyor.

- **Postgres** — 5432 yarışını kaybeden konteyner sessizce başlamaz, ama
  `DATABASE_URL` kazanan sunucuya gayet mutlu bağlanır. Buradaki ilk belirtisi,
  bu projeden hiç haberi olmayan bir veritabanından gelen kimlik doğrulama
  hatasıydı.
- **Redis** — daha kötüsü: kimlik doğrulaması yok, veritabanları isimli değil
  numaralı. Bu uygulamanın önbelleği başka bir projenin instance'ının içine
  düşer ve hiçbir yerde hiçbir şey sorun bildirmez.
- **Vite** — sessizce bir sonraki boş porta kayar, sonra CORS'ta patlar; çünkü
  API alamadığı porta göre yapılandırılmıştır.

Compose ağının içinde portlar değişmemiştir. API'nin kendi varsayılanı hâlâ
3000'dir — dağıtım `PORT` ile söyler. Vite'ın portu `apps/web/vite.config.ts`
içinde `strictPort` ile sabitlenmiştir, böylece sessizce kaymak yerine sesli
biçimde başarısız olur. CI her şeyi standart portlarda bırakır: bir servis
konteyneri runner'ı kendine ayırmıştır.

---

## Komutlar

Hepsi kök dizinden çalışır ve Turborepo ile paketlere dağılır.

```bash
pnpm lint
pnpm typecheck
pnpm test        # birim testleri  (API 149, web 44)
pnpm test:e2e    # e2e testleri    (144) — postgres + redis ayakta olmalı
pnpm build
pnpm --filter web test:smoke   # gerçek tarayıcıda; önce build gerekir
```

### `test:smoke` neden ayrı

Uygulamayı **çalıştıran** tek kontrol odur. Geri kalan her şey uygulamayı hiç
yüklemeden inceler — üç sayfanın hata sınırından başka bir şey render etmeden
yayına çıkması tam olarak böyle oldu: tipler doğruydu, build başarılıydı ve
hiçbir test o sayfaları mount etmiyordu.

Playwright, build edilmiş API'yi ve web uygulamasını kendisi ayağa kaldırır,
giriş yapar ve her sayfanın yakalanmamış hata ve 5xx olmadan render olmasını
şart koşar. Yaklaşık on saniye sürer; CI build'den sonra çalıştırır.

`pnpm --filter web test:smoke:dev` aynı suite'i Vite geliştirme sunucusuna
yöneltir. Bu tekrar değil: yazılma sebebi olan hata yalnızca dev'de
görünüyordu, çünkü üretim bundler'ı dev sunucusunun çözemediğini çözüyor.

### E2E hakkında iki not

E2E suite'leri seri çalışır (`--runInBand`): tek bir veritabanını paylaşırlar,
yani bağımsız değildirler. Paralel çalıştırmak, rastgele görünen ama aslında
bir suite'in diğerinin yarım kalmış durumunu okumasından kaynaklanan hatalar
üretiyordu.

`test:e2e` ayrıca kendi çalışması için IP başına limitleri yükseltir. Suite'in
her isteği tek bir adresten gelir, yani gerçek bir dağıtımı koruyan limitler
suite'in kendi trafiğini reddeder. Bu, `.env.example`'ı kopyalayıp README'yi
izleyen herkes için altı testin 429 ile düşmesi demekti. Değişkenleri kendiniz
verirseniz o değerler geçerli olur.

---

## Mimari

Modüler monolit: tek bir dağıtılabilir API, şemanın kendi parçasına sahip
çıkan modüllere bölünmüş ve birbirleriyle yalnızca ilan edilmiş bir yüzey
üzerinden konuşuyor.

```
apps/api/src/
  common/            paylaşılan çekirdek — guard, filter, interceptor,
                     middleware, CRUD tabanı, AuthenticatedUser, oran
                     limitleri. Hiçbir özellik modülünü import etmez.
  prisma/ cache/ config/    altyapı. Aynı kısıt.
  sales/             fiş okuma modeli: metrik, granülerlik ve boyut sözlüğü
                     ile bunu ifade eden SQL
  auth/ users/ catalog/ geo/ people/ transactions/ health/
  dashboard/ charts/ tables/ kds/ spatial-forecast/    sales/ üzerinde analitik
packages/contracts/  iki tarafın da derlendiği HTTP sözleşmesi
```

### İki kural — hatırlanan değil, zorlanan

1. **Paylaşılan çekirdek ve altyapı modülleri bir özellik modülünü import
   edemez.** Bağımlılık oku yalnızca içeri doğrudur.
2. **Bir modül komşusuna `index.ts` üzerinden ulaşır, başka hiçbir şeyle
   değil.** Komşunun kullanması gereken her şey orada export edilir; gerisi
   özeldir ve depo genelinde arama yapmadan değiştirilebilir.

`eslint-plugin-boundaries` ikisini de zorlar (`apps/api/eslint.config.mjs`).
Element'leri klasörlere göre eşleştiği için `src/` altındaki kompozisyon kökü
dosyaları hiçbir element'e ait değildir ve kural onları göremez; her modülü
import etmelerine izin verilir — zaten var oluş sebepleri budur — ama
`src/*.ts`'e daraltılmış bir `no-restricted-imports` kuralı onları da ikinci
kurala bağlar.

`test/` kasıtlı olarak bunun tamamen dışındadır: e2e suite'leri controller'lardan
test modülleri kurar, controller ise bir modülün komşusuna export etmesi
gereken bir şey değil, HTTP giriş noktasıdır.

Denemek için: `../sales` yerine `../sales/sales.sql` import edin ya da
`common/`'un bir modülü import etmesini sağlayın — `pnpm lint` sınırı adıyla
söyleyerek düşer.

### Satış okuma modeli

Altı modül `receipts` ve `receipt_items` üzerinde sorgu yapar. Her toplamı tek
bir jenerik kurucudan geçirmek yerine — sorgu şekilleri gerçekten farklı ve o
dolaylılık hiçbir şey kazandırmazdı — `sales/sales.sql.ts` **sözlüğe** sahip
çıkar: fact join'i, beş metrik ifadesi, yedi periyot ifadesi ve yedi boyut
join'i. Modüller kendi sorgularını bu parçalardan kurar.

Bir metrik altı modül boyunca otuz yerde adlandırılıyordu — yirmi altısı elle
yazılmış, dördü Charts'ın özel tuttuğu tablolarda. Yani bir kolonu yeniden
adlandırmak otuzunu da grep'le bulmak demekti ve bulabilecek tek şey grep'ti:
tip sistemi bir template literal'in içini göremez.

Her parça, sorgunun `receipts`'i `r`, `receipt_items`'ı `ri` olarak
adlandırdığını varsayar. Paylaşmanın bedeli bu.

### API/web sözleşmesi

`@hakmar/contracts` yanıt şekillerini ve query string'de yolculuk eden
sözlükleri tutar. İki uygulama da buna karşı derlenir, böylece bir anlaşmazlık
üretimde birinin fark ettiği boş bir kolon değil, bir **build hatası** olur.

Query string'de giden her sözlük API'de bir TypeScript enum'u, sözleşmede bir
string union olarak tanımlanır ve derleme zamanında ikisinin aynı kümeyi
tarif ettiği doğrulanır. Yalnızca bir tarafa üye eklerseniz build, üyeyi ve
eksik tarafı adıyla söyleyerek düşer.

Bu; satış metrik/granülerlik/boyutunu (`sales.model.ts`), dashboard periyodunu,
üç tahmin enum'unu, ısı haritası eksen eşleşmelerini, `/tables` sıralama
varlığını, GeoJSON belge tipini ve `/charts/ranking`'in kabul ettiği beşte
üçlük alt kümeyi kapsar. Bunların dördü asıl boşluktu: ikisi yalnızca API'nin
içinde vardı, web listenin kendi elle yazılmış kopyasını tutuyordu; sıralama
alt kümesi ise iki tarafta bağımsız olarak yazılmıştı ve hiçbir şey ikisini
karşılaştırmıyordu — bir sayfanın, API'nin 400 ile yanıtladığı bir dropdown
seçeneği sunması tam olarak böyle olur.

`Role` bir değil iki komşuya karşı kontrol edilir. Bir alan kavramı olduğu için
onu `common/types/role.ts` tanımlar — on dokuz dosya onu `generated/prisma`'dan
import ediyordu, bu da bir şema artefaktını guard'ların, dekoratörlerin ve
DTO'ların üzerine kurulduğu bir fikrin tanımı hâline getiriyordu. Kolona hâlâ
Prisma sahip; o dosya üçünün uyuştuğunu doğrular.

Para ve tarihin işin içinde olduğu yerde sözleşme onların temsili üzerinden
parametriktir (`SummaryDto<M = string>`): API bir Postgres numeric'ini
`Prisma.Decimal`, bir tarihi `Date` olarak tutar ve ikisi de JSON'dan geçerken
string olur. Aksini varsaymak paylaşılan bir tipi dekoratif kılar.

Başarısız yanıtlar da sözleşmededir (`ApiErrorEnvelope`). Web her başarısız
istekte bundan `error.message` okur ve bunu, okuyan tek yerde satır içi yazılmış
yapısal bir tiple yapıyordu — yani iki taraf yalnızca tesadüfen anlaşıyordu.

Kasıtlı olarak paylaşılmayan: `/geo/geojson/city` içindeki GeoJSON belgesi,
API'nin gerçekten tarif edemeyeceği bir JSON kolonudur; `GeoJsonPayload<T>` onu
orada `unknown` bırakır ve şekli, onu çizen harita bileşeni verir. Bir tarafın
ikisi adına iddiada bulunması değil, bir parametre.

### Web

`apps/web/src/features/<ad>/queries.ts` o özelliğin yaptığı her isteğe — cache
anahtarları dahil — sahiptir; sayfalar hook'ları tüketir, asla URL kurmaz.
Gönderilen parametrelerle uyuşmayan bir cache anahtarı tek bir ekranda bayat
veri gösterir ve diğer her yerde görünmezdir; bu da ancak ikisi ayrı ayrı
yazıldığında mümkündür.

Yazma kontrolleri, kullanamayacak rollerden gizlenir (`useHasRole`, API'nin
`@Roles()`'unu yansıtır). Bu uygulama değil sunum katmanıdır — istemci ne
render ederse etsin sunucu isteği reddeder — ama tek olası sonucu 403 olan bir
düğme, izin sınırı gibi değil bozuk ekran gibi okunur.

Çıkış yapmak React Query cache'ini temizler. Cache, herhangi bir oturumdan uzun
yaşayan modül düzeyinde bir singleton'dır ve hiçbir parçası kullanıcıya göre
anahtarlanmamıştır; bu olmadan aynı makinede giriş yapan sonraki kişiye önceki
hesabın cache'lenmiş yanıtları servis edilir.

---

## API

Tüm rotalar `/api/v1` altındadır ve bearer access token ister.

| Alan | Rotalar |
| --- | --- |
| Auth | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/profile` |
| Health | `GET /health` (liveness), `GET /health/ready` (readiness) |
| Dashboard | `GET /dashboard/summary`, `/general-stats`, `/performance/:period`, `/daily-summary`, `/monthly-sales` |
| Charts | `GET /charts/trend`, `/ranking`, `/heatmap`, `/basket-size`, `/profit-waterfall`, `/customer-loyalty`, `/geographic-sales` |
| Tables | `GET /tables/ranking`, `/price-cost-history`, `/region-cost` |
| KDS | `GET /kds/abc-analysis`, `/demand-forecast`, `/customer-segmentation`, `/market-basket` |
| Tahmin | `POST /spatial-forecast/run`, `GET /spatial-forecast/runs`, `/runs/:id` |
| Catalog | `/catalog/categories`, `/subcategories`, `/brands`, `/products` — listele/oku/oluştur/güncelle/sil |
| Geo | `/geo/regions`, `/cities`, `/branches` — CRUD; `GET /geo/geojson/city` harita sınırları |
| People | `/people/customers`, `/cashiers` — CRUD |
| Users | `/users` (yalnız SUPERADMIN) — CRUD, `PATCH /users/:id/password`; `PATCH /users/me/password` her rol için |
| Transactions | `GET /transactions/receipts` (sayfalı; tarih aralığı / şube / kasiyer / müşteri filtresi), `GET /transactions/receipts/:id` |

### Yetkilendirme

RBAC **fail-closed**: ne `@Roles()` ne `@Public()` taşıyan bir rota reddedilir,
yani yeni bir endpoint unutulma yoluyla korumasız bırakılamaz.

Ana veri rotaları her role okumaya açık, ADMIN ve üstüne yazmaya kısıtlıdır —
controller başına değil, metot başına karar verilir. Liste endpoint'leri
sayfalıdır (`limit`, `offset`, `search`) ve `{ items, total, limit, offset }`
döner; `search`'ün hangi kolonlarda eşleştiğini her servis sabitler, çağıran
asla belirlemez.

Hesap yönetimi yalnızca SUPERADMIN'e açıktır ve API, bir kurulumu kurtarılamaz
hâle getirecek istekleri reddeder: kendi hesabınızı kapatmak, rolünüzü
düşürmek, kendinizi silmek ya da son aktif süper yöneticiyi kaldırmak.

### Hata yanıtları

Silmeye çalıştığınız kayıt hâlâ referans alınıyorsa 409, tekrar eden bir anahtar
409 döner — ikisi de 500 olmak yerine. Prisma hata kodları bu uygulamanın
gerçekten üretebileceği HTTP yanıtlarına eşlenir; eşlenmemiş bir kod gerçek bir
sunucu hatasıdır ve kodu ile birlikte log'lanır, böylece boşluk sessiz kalmaz.

### Parametreli sorgular

Charts ve Tables rotaları, eski uygulamadaki ~51 neredeyse aynı endpoint'in
yerini alır. SQL'e ulaşan her parametre önce bir enum'a karşı doğrulanır, sonra
yalnızca önceden yazılmış `Prisma.Sql` parçalarından oluşan bir arama
tablosunda anahtar olarak kullanılır. **Kullanıcı girdisi hiçbir zaman SQL
metnine dönüşmez.**

### Önbellek

Analitik endpoint'leri Redis'ten yanıtlar (5–60 dakika, rotaya göre). Ana veriye
yapılan başarılı bir yazma tüm cache'i temizler: hangi anahtarların
etkilendiğini hesaplamak yerine hepsini atmak kasıtlıdır — girdiler URL'e göre
anahtarlanır, tek bir ana veri değişikliği neredeyse her toplamı etkileyebilir
ve bu yazmalar tanımı gereği seyrektir.

Tahminin **sonucu** cache'lenmez (parametre uzayı geniş ve her çağrı kaydedilen
bir olaydır), ama **girdisi** cache'lenir. `loadMonthlyHistory()` hiç parametre
almaz: her seferinde `receipt_items`'ın tamamı üzerinde birebir aynı toplamdır
ve uygulamadaki en pahalı sorgudur. Bir saat cache'lenir — ay granülerliğinde
bir seri için doğru ölçek — ve Redis'e ulaşılamıyorsa hem okuma hem yazma
veritabanına düşer: en kötü ihtimalle önlenmek istenen tarama geri gelir,
sayfa düşmez.

---

## Güvenlik

### Oturum

Kısa ömürlü bir access token yalnızca tarayıcı belleğinde tutulur. Yenileme
token'ı ise sadece `/api/v1/auth` kapsamına alınmış, `SameSite=Strict`,
httpOnly bir çerez olarak vardır — kimlik bilgisinin hiçbir parçasına
JavaScript'ten erişilemez.

O çerez, API'nin bir çerezden kabul ettiği tek şey olduğundan ve diğer her rota
bearer başlığıyla doğrulandığından, siteler arası bir isteğin istismar edeceği
bir şey yoktur ve ayrı bir CSRF token'ına gerek kalmaz.

Zaten döndürülmüş bir yenileme token'ı sunmak tüm oturum ailesini iptal eder.
Rotasyon, sunulan token'ı tek bir koşullu güncellemeyle sahiplenir; böylece aynı
anda gelen iki yenileme tek bir token üzerinden ikisi birden başarılı olamaz.

Şifre sıfırlamak, hesabı kapatmak veya rol değiştirmek o kullanıcının yenileme
token'larını iptal eder. Rol access token'ın içinde yolculuk ettiği için bu,
artakalan yetkiyi oturumun kendini yenilediği süre boyunca değil, tek bir token
ömrüyle (varsayılan 20 dakika) sınırlar.

### Giriş uç noktası

Kullanıcı bulunamadığında bile bcrypt karşılaştırması bir kukla hash'e karşı
çalışır. Erken dönmek, hesap varlığını yanıt süresi üzerinden sızdırıyordu:
ıskalama ~1ms, isabet ~100ms sürüyordu — ölçülmesi kolay bir fark ve giriş
endpoint'ini bir kullanıcı adı kâhinine çeviriyor.

Şifre kuralı yalnızca uzunluk değil: 12–128 karakter, en az bir küçük harf, bir
büyük harf ve bir rakam. `MinLength(12)`'yi geçen ama on iki aynı karakterden
oluşan bir şifre kısa olandan anlamlı ölçüde güçlü değildir.

Şifre hash'leri, her okumanın geçtiği projeksiyonun dışındadır — yani unutma
yoluyla bir yanıta ulaşamaz.

### Oran limitleri

Dördü de IP başınadır ve tek bir pencerede sayılır (`RATE_LIMIT_TTL_MS`).

| Değişken | Varsayılan | Kapsam |
| --- | --- | --- |
| `GLOBAL_RATE_LIMIT` | 60 / dk | Kendi limitini bildirmeyen her rota |
| `LOGIN_RATE_LIMIT` | 5 / dk | Giriş denemeleri |
| `SESSION_RATE_LIMIT` | 20 / dk | Yenileme + çıkış |
| `FORECAST_RATE_LIMIT` | 10 / dk | `POST /spatial-forecast/run` |

Tek pencere kasıtlıdır: tek bir NAT arkasındaki bir ofis için pencereyi
genişleten bir operatör "burada daha uzun bir süre boyunca say" demektedir ve
bunun limitlerin yalnızca bir kısmında etkili olması bir tuzaktır.

Bir sayfa açılışı tek bir istek değildir — Grafikler altı panel, Genel Bakış
beş panel çeker. Tek bir çıkış adresinin arkasında bunlar kişiler arasında
toplanır, yani halka açık bir dağıtımı koruyan limit tam olarak bir katı
analisti kilitleyen limittir. Varsayılanı bırakın; ihtiyaç varsa
`GLOBAL_RATE_LIMIT` ile söyleyin.

Tahmin kendi limitini taşır çünkü sonucu cache'lenemeyen tek pahalı rotadır.
Diğer her analitik endpoint Redis'ten yanıtlar, yani bir isteği tekrarlamak
neredeyse bedavadır.

Sağlık probları hiç kısıtlanmaz: birkaç saniyede bir tek adresten yoklayan bir
prob, IP başına limitin durdurmak için var olduğu trafiğin ta kendisidir ve
kendi sağlık kontrolünü kısıtlayan bir instance, cevabın en çok önem taşıdığı
anda — yük altında — kendini düşük bildirir.

### İçerik güvenliği

Build edilmiş web uygulaması, `script-src`'ünde `'unsafe-inline'` taşımayan bir
Content-Security-Policy ile servis edilir: sayfadaki her satır içi script build
zamanında hash'lenir, yani enjekte edilen bir tanesi hiç çalışmaz.
`connect-src`, `img-src` ve `form-action` ise bir enjeksiyonun dışarı bir şey
göndermek için kullanacağı yolları kapatır.

Bu, denetimin beşinci kritik bulgusunun ("XSS + localStorage'da JWT + CSP yok")
son üçte biriydi; diğer ikisi bellekteki access token ve httpOnly çerezle zaten
yanıtlanmıştı.

`frame-ancestors` ve HSTS bir `<meta>` etiketinden gelemez, dolayısıyla o ikisi
dosyaları servis eden şeye — `apps/web/nginx.conf` — aittir.

### Bağımlılıklar

CI `pnpm audit --prod --audit-level high` çalıştırır ve yüksek şiddetli bir
uyarı build'i düşürür. Bir üst paketin henüz yükseltmediği geçişli bağımlılıklar
`pnpm-workspace.yaml` içindeki `overrides` ile yamalı sürüme zorlanır; oradaki
her satır susturulmuş değil **yanıtlanmış** bir uyarıdır.

Dependabot haftalık olarak npm, aylık olarak GitHub Actions ve Docker temel
imajlarını izler.

---

## Gözlemlenebilirlik

Her isteğe bir **request id** atanır ve her tamamlanan istek tek bir satır
log'lar:

```
LOG [HTTP] GET /api/v1/charts/trend?granularity=month 200 34.3ms [a852a2b1-…]
```

Önceden burada hiçbir şey yoktu: erişim log'u yok, süre yok, log'daki bir 500'ü
onu üreten isteğe bağlamanın yolu yok. Bu geliştirmede yaşanabilir bir
durumdur — düşen istek, az önce yaptığınız istektir — ama bir dağıtımda değil:
"bu sabah panel yavaştı" sorusunun cevabı, sürecin yazdıklarından çıkabilmeli.

- Gelen bir `X-Request-Id` varsa **korunur**, böylece istekleri zaten izleyen
  bir proxy ya da çağıran kendi id'sini bu adımda kaybetmez. Gelen değer
  sınırlanır ve bir log satırını taklit edebilecek karakterlerden arındırılır —
  başlıktaki bir satır sonu, log injection'ın tamamıdır.
- Id yanıtta geri döner ve **5xx'in gövdesine** konur. 500 bilerek hiçbir şey
  söylemez, bu da kullanıcıya bildirecek bir şey bırakmaz; web o numarayı
  gösterir, böylece "bir hata oluştu" raporu log'daki yığın izini bulur.
- Interceptor değil **middleware**: böylece hiçbir handler'a ulaşmayan
  istekleri de kapsar — bir 404 ve bir guard'ın reddettiği her şey, ki
  throttler'ın 429'ları oradadır.
- Sağlık proplarının **başarılı** yanıtları log'lanmaz. Konteyner sağlık
  kontrolü on saniyede bir yoklar; günde dokuz bin satırın hiçbir şey
  söylememesi, log'lamamaktan daha kötüdür — gerçek satırları bulmayı
  zorlaştıran şey o hacimdir. Düşmeye başlayan bir prob ise bu dosyanın
  içerebileceği en önemli satırdır ve o log'lanır. Her ikisi de id alır.

### İki sağlık probu

İki farklı soruya cevap verirler ve bir dağıtım cevaplarla iki farklı şey yapar.

| Uç | Soru | Bağımlılık |
| --- | --- | --- |
| `GET /health` | Bu süreç ayakta mı? | Yok, kasıtlı olarak |
| `GET /health/ready` | Bu instance gerçekten istek karşılayabilir mi? | Postgres + Redis |

**Liveness** hiçbir şeye dokunmaz. Veritabanı düştüğünde başarısız olan bir
liveness probu, bir veritabanı hıçkırığını her replikada bir yeniden başlatma
döngüsüne çevirir — API'yi yeniden başlatmak Postgres'i düzeltemez ve her
yeniden başlatma ısınmış bir bağlantı havuzunu çöpe atar.

**Readiness** yük dengeleyicinin yoklaması gereken ve compose'un API'ye bağlı
her şeyi başlatmadan önce beklediği proptur. Bir bağımlılık düştüğünde gövdede
hangisi olduğunu söyleyerek **503** döner — gövde faydalıdır, ama bir proxy'nin,
bir orkestratörün ve `curl -f`'in gerçekten okuduğu şey durum kodudur.

Redis kontrolü bir ping değil, bir yazma ve geri okumadır: bağlantı kabul eden
ama yazmaları reddeden bir Redis — belleği dolmuş ya da salt-okunur bir replika
— ping'e gayet mutlu cevap verirken uygulamadaki her cache yazması başarısız
olur.

Her probun bir zaman aşımı vardır. Zaman aşımı olmadan erişilemeyen bir Postgres
kontrolü düşürmez, **askıda bırakır** — ki bir yük dengeleyici bunu bozuk bir
instance değil yavaş bir instance olarak okur ve probun kendisi hiç cevap
vermeyen şey hâline gelir.

---

## Dağıtım

`docker-compose.yml` yalnızca Postgres ve Redis'i başlatır, böylece `pnpm dev`
konuşacak bir şey bulur. `docker-compose.prod.yml` uygulamanın kendisini build
edip çalıştırır: önde nginx, arkasında API, ikisinin de arkasında iki servis.

```bash
cp .env.prod.example .env.prod        # sonra doldurun
docker compose -f docker-compose.prod.yml --env-file .env.prod build
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm migrate
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Sonra bir kereye mahsus, ilk süper yöneticiyi ve il sınırlarını ekleyin:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  run --rm --entrypoint ./node_modules/.bin/tsx migrate prisma/seed.ts
```

`prisma db seed` yerine doğrudan seed script'i: o komut PATH'ten `tsx` çağırır,
konteynerin içinde ise `tsx` yalnızca `node_modules/.bin` altındadır. `pnpm
exec` de ilgili bir sebeple elenir — pnpm 11 herhangi bir şey çalıştırmadan önce
kurulu ağacı lockfile'a karşı doğrular ve TTY yokken bu doğrulama kendi
kurulumunu denemeye kalkıp alamayacağı bir onay isteyerek düşer.

Yalnızca nginx bir port yayınlar. Postgres, Redis ve API compose ağında
erişilebilirdir, başka hiçbir yerde — API'nin kendi varsayılanı olan 3000'de
çarpışacak hiçbir şey olmadan dinlemeye devam edebilmesinin sebebi budur.

### Proxy neden önde

nginx hem build edilmiş uygulamayı servis eder **hem de** `/api`'yi API'ye
proxy'ler, yani tarayıcı tek bir origin'le konuşur. Bu bir kolaylık değil:

- Siteler arası istek yoksa CORS da yoktur ve uygulamanın gerçekten servis
  edildiği yerle senkron tutulacak bir `WEB_ORIGIN` de yoktur.
- Yenileme çerezinin `SameSite=Strict`'i, uygulama ile API'nin iki ana ad
  üzerinde anlaşmasına gerek kalmadan işini yapar.
- `<meta>` etiketinin taşıyamayacağı güvenlik başlıklarının konabileceği tek
  yer orasıdır. Tarayıcılar işaretleme olarak gelen bir politikadaki
  `frame-ancestors`'ı yok sayar, dolayısıyla sayfanın kendi CSP'si çerçevelemeyi
  yasaklayamaz. Bu direktifi `X-Content-Type-Options`, `Referrer-Policy` ve bir
  `Permissions-Policy` ile birlikte nginx ekler. İki politika birbirini asla
  zayıflatmaz: her biri kendi başına uygulanır.

`VITE_API_URL` bu yüzden imajda `/api/v1`'dir ve build zamanında gömülür — Vite
onu bundle'a yazar, yani konteynere sonradan söylenebilecek bir şey değil,
imajın bir özelliğidir.

### Yedekleme

`backup` servisi Postgres'in yanında çalışır ve zamanlayıcıyla sıkıştırılmış bir
`pg_dump` alır (`ops/pg-backup.sh`). Varsayılan olarak günde bir, on dört günlük
saklama.

Dump'lar `.part` adıyla yazılır ve yalnızca başarıda yeniden adlandırılır,
böylece yarıda kesilmiş bir dump asla tamamlanmış sanılmaz — bir yedeği yanlış
bir güvenlik hissine çeviren hata budur. Eskiler yalnızca **başarılı** bir
dump'tan sonra budanır; koşulsuz budamak, iki haftalık hatanın son iyi yedeği
sessizce silmesine izin verirdi.

`BACKUP_PATH` varsayılan olarak bir host dizinidir, böylece dump'lar
`docker compose down -v`'den sağ çıkar — zaten var oldukları kaza tam olarak
budur. Kendisi başka bir yere kopyalanan bir mount'a yönlendirin: veritabanıyla
aynı diskteki bir yedek, yedek değildir.

Geri yükleme:

```bash
# .env.prod'daki POSTGRES_USER / POSTGRES_DB değerlerini yazın: --env-file
# yalnızca konteynere geçer, komutu yazdığınız kabuğa değil.
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  exec -T postgres pg_restore -U hakmar -d hakmar --clean --if-exists \
  < backups/hakmar-<zaman-damgası>.dump
```

### Bir dağıtımın hâlâ borçlu olduğu

- **TLS.** Yayınlanan portun önünde sonlandırın. `COOKIE_SECURE`,
  `.env.prod.example`'da varsayılan olarak `true`'dur ve öyle kalmalıdır:
  yenileme çerezi yedi günlük bir kimlik bilgisidir ve düz HTTP üzerinde
  yolculuk etmesi söz konusu olamaz. `Strict-Transport-Security`
  `apps/web/nginx.conf` içinde yazılı ama yorum satırıdır — yalnızca TLS'i
  sonlandıran sunucu o ise açın.
- **`TRUST_PROXY`.** Compose dosyasında `1` olarak ayarlı ve bu düzen için —
  önde tek proxy — doğrudur. Daha fazlasını koyarsanız değiştirin, yoksa IP
  başına limitler arkadaki herkes için tek bir paylaşılan kovaya çöker.
- **Migration'lar.** API'yi ayağa kaldırmadan önce `run --rm migrate`, ve yeni
  migration taşıyan her dağıtımdan sonra tekrar. Ayrı bir imaj olması kasıtlı:
  onları uygulayan Prisma CLI bir geliştirme bağımlılığıdır ve runtime imajında
  yoktur; bir şema değişikliği de yeniden başlatmanın yan etkisi değil,
  gözlenebilir bir adım olmalıdır — özellikle aynı anda birden fazla API
  replikası başlıyorsa.

---

## Durum

Eski uygulamanın her özellik alanının artık bir karşılığı var.

**Tamamlanan:** kesişen NestJS mimarisi (guard/interceptor/filter/middleware,
doğrulanmış ortam, Redis cache, iki sağlık probu), Prisma şeması ve
migration'lar, rotasyonlu yenileme token'ları ve tekrar tespitiyle auth, ve
Dashboard, Grafikler, Tablolar, KDS Analiz, Tahmin, İşlemler, Yönetim,
Kullanıcılar modülleri — CI'da birim, e2e ve tarayıcı kapsamıyla.

### Tahmin ve Senaryo

Her şehrin (veya bölgenin) kendi aylık geçmişi üzerine bir sıradan en küçük
kareler modeli oturtur: doğrusal trend artı mevsimsellik için iki Fourier
harmoniği. Üzerine indirim / maliyet / satın alma gücü senaryoları bindirir.

Bir indirim tek bir kategoriye ya da ürüne yöneltilebilir; bu durumda API o
hedefin gerçek ciro payını veritabanından okur, varsaymaz. Geçmişi yetersiz olan
alanlar ortalamalarına düşer ve fit edilmiş gibi sunulmak yerine öyle
etiketlenir.

Her çalıştırma `spatial_forecast_runs`'a kaydedilir ve sayfanın geçmiş
listesinden yeniden yüklenebilir — yeniden hesaplamak yerine o çalıştırmanın
gerçekten ürettiği sayıları çizer. Tablo en yeni 200 çalıştırmayı tutar,
gerisini budar: her satır alan başına eksiksiz bir sonuç tutar, yani hepsini
sonsuza dek saklamak, herkesin basılı tutabileceği bir düğme üzerinde saf
büyüme olurdu.

Şehir çalıştırmaları Türkiye'nin 81 ilinin koroplet haritası olarak, plaka koduna
göre eşleştirilerek çizilir — `cities.plate_code`'un unique olmasının sebebi
budur: eşleşme anahtarıdır ve aynı kodu paylaşan iki şehir sessizce birbirinin
üzerine boyar. Sınır verisinin kaynağı ve lisansı için
`apps/api/prisma/data/README.md`.

### Yönetim

Dokuz ana veri varlığının hepsini tek bir bildirimsel kaynak tanımı tablosundan
sürer; yabancı anahtarlar, ilgili endpoint'ten doldurulan dropdown'lar olarak
render edilir. Bu jenerik yaklaşım istemcide, sunucuda olamayacağı kadar
güvenlidir: API her yazmayı yine de doğrular, yani tablodaki bir hata
doğrulanmamış bir yazma değil, formun gösterdiği bir 400 üretir.

### Denetimden taşınan kararlar

MySQL yerine Postgres, eski ad-hoc cache yerine Redis, Sequelize yerine Prisma,
ham SQL yönetim aracı yerine Prisma Studio, yetim kalmış Subcategory ilişkisinin
tamamlanması ve uygulanamaz stok temelli fiyatlama kuralının düşürülmesi.
