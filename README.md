# HDFilmizle Stremio Eklentisi

HDFilmizle.to sitesinden film ve dizileri Stremio'da izlemek için geliştirilmiş eklenti.

## 🚀 Kurulum

### 1. Bağımlılıkları Yükle

```bash
npm install
```

### 2. Sunucuyu Başlat

```bash
npm start
```

veya geliştirme modu için:

```bash
npm run dev
```

## 📝 Stremio'ya Ekleme

1. Sunucuyu başlattıktan sonra terminalde görünen URL'i kopyalayın:
   ```
   http://127.0.0.1:7000/manifest.json
   ```

2. Stremio uygulamasını açın

3. Ayarlar (⚙️) > Eklentiler (Addons) bölümüne gidin

4. Sayfanın en altında bulunan "Topluluk Eklentileri" kısmında URL kutusuna manifest URL'ini yapıştırın

5. "Yükle" (Install) butonuna tıklayın

6. Eklenti artık Stremio kataloğunuzda görünecek!

## 🎯 Özellikler

✅ Film ve dizi katalogları
✅ Otomatik stream tespiti
✅ Çoklu stream desteği
✅ HLS/M3U8 stream desteği
✅ iframe embed desteği

## ⚙️ Yapılandırma

### Port Değiştirme

Varsayılan port 7000'dir. Değiştirmek için:

```bash
PORT=8080 npm start
```

### Base URL Değiştirme

`addon.js` dosyasındaki `BASE_URL` değişkenini düzenleyin:

```javascript
const BASE_URL = 'https://www.hdfilmizle.to';
```

## 🔧 Sorun Giderme

### Stream oynatılamıyor
- Sitenin HTML yapısı değişmiş olabilir
- Stream linklerinin formatı farklı olabilir
- VPN kullanmayı deneyin

### Katalog yüklenmiyor
- İnternet bağlantınızı kontrol edin
- Sitenin erişilebilir olduğundan emin olun
- Console loglarını kontrol edin

### Eklenti görünmüyor
- Manifest URL'inin doğru olduğundan emin olun
- Sunucunun çalıştığını kontrol edin
- Stremio'yu yeniden başlatın

## 📂 Dosya Yapısı

```
stremio-hdfilmizle/
├── addon.js          # Ana eklenti mantığı
├── server.js         # HTTP sunucusu
├── package.json      # NPM bağımlılıkları
└── README.md         # Bu dosya
```

## 🛠️ Geliştirme

### Kod Yapısı

- **manifest**: Eklenti bilgileri (catalog, meta, stream)
- **fetchCatalogFromHome()**: Ana sayfadan film/dizi listesini çeker
- **fetchSeriesMeta()**: Dizi sayfasından sezon/bölüm listesini çıkarır
- **fetchMovieMeta()**: Film sayfasından meta bilgisi çeker
- **getStreamLinks()**: İzleme sayfasından iframe/m3u8 ve DUAL linklerini bulur
- **defineCatalogHandler()**: Katalog isteklerini işler
- **defineMetaHandler()**: Film/dizi detay ve (diziler için) bölüm listesini döner
- **defineStreamHandler()**: Stream isteklerini işler

## ⚠️ Önemli Notlar

- Bu eklenti yalnızca eğitim amaçlıdır
- Telif haklarına saygı gösterin
- Yasal içerik kaynaklarını tercih edin
- Eklenti kişisel kullanım içindir

## 📄 Lisans

MIT License

## 🤝 Katkıda Bulunma

Pull request'ler kabul edilir. Büyük değişiklikler için lütfen önce bir issue açın.

---

**Not**: Site yapısı değiştiğinde CSS selector'larını güncellemeniz gerekebilir.
