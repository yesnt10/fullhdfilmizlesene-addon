# FullHD Film İzlesene - Stremio Eklentisi

Bu eklenti, fullhdfilmizlesene.tv sitesinden film içeriklerini Stremio'da izlemenizi sağlar.

## 🚀 Kurulum

### Gereksinimler
- Node.js (v14 veya üzeri)
- npm

### Adımlar

1. **Bağımlılıkları yükleyin:**
```bash
npm install
```

2. **Eklentiyi başlatın:**
```bash
npm start
```

3. **Stremio'ya ekleyin:**
   - Tarayıcınızda `http://127.0.0.1:7000/manifest.json` adresine gidin
   - Veya Stremio uygulamasında: **Addons** → **Community Addons** → URL girin
   - Manifest URL'i: `http://127.0.0.1:7000/manifest.json`

## 📖 Kullanım

1. Eklentiyi yükledikten sonra Stremio'yu açın
2. "Discover" sekmesinde "FullHD Film İzlesene" kataloğunu göreceksiniz
3. Film seçin ve izlemeye başlayın!

## ⚙️ Yapılandırma

Port değiştirmek için:
```bash
PORT=8080 npm start
```

## 🛠️ Geliştirme Notları

### Özellikler:
- ✅ Film kataloğu
- ✅ Otomatik stream bulma
- ✅ Çoklu kaynak desteği
- ✅ HLS ve MP4 formatları

### Site Yapısına Göre Ayarlamalar:
Eklenti, sitenin HTML yapısını analiz ederek içerikleri çeker. Site yapısı değişirse, `addon.js` dosyasındaki CSS selector'ları güncellemeniz gerekebilir:

```javascript
// Film listesi için selector'lar
$('.movie-item, article, .film-item, .post')

// Stream linkler için
$('iframe'), $('source'), $('[data-src]')
```

## 📝 Önemli Notlar

- Bu eklenti eğitim amaçlıdır
- Telif hakkı yasalarına uygun kullanın
- Site yapısı değişebileceği için düzenli güncelleme gerekebilir
- İnternet bağlantınızın hızına bağlı olarak yükleme süreleri değişebilir

## 🐛 Sorun Giderme

**Filmler görünmüyor:**
- Sitenin erişilebilir olduğundan emin olun
- Console loglarını kontrol edin: `npm start`

**Stream oynatılamıyor:**
- Bazı stream kaynakları harici player gerektirebilir
- Farklı bir kaynak seçmeyi deneyin

**Eklenti Stremio'da görünmüyor:**
- Manifest URL'inin doğru girildiğinden emin olun
- Eklentinin çalıştığını kontrol edin (terminal'de mesaj görmelisiniz)

## 📄 Lisans

MIT License - Eğitim amaçlı kullanım için
