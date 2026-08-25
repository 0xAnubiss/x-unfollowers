# X Unfollowers

**Türkçe** · [English](README.en.md)

Chrome / Edge eklentisi. X’te **seni takip etmeyenleri** bulur, listeler; **sadece senin işaretlediklerini** verdiğin saniye aralığıyla, birer birer takipten çıkarır.

Veri hiçbir sunucuya gitmez. Her şey tarayıcıda, açık olan x.com oturumunla çalışır.

## Özellikler

- Takip listeni tarar, seni geri takip etmeyenleri gösterir
- Arama, tümünü seç / hiçbiri, veya tek tek işaretleme
- Yıldız ile koruma listesi; o hesaplar seçilmez
- Ayarlanabilir aralık (saniye / kişi)
- İsteğe bağlı rastgele sapma (±%20)
- İstediğin an durdurma
- Günlük çıkarım sayacı (yalnızca cihazında)

## Kurulum (Chrome veya Edge)

1. Bu repoyu indirip aç veya klonla:
   ```bash
   git clone https://github.com/0xAnubiss/x-unfollowers.git
   ```
2. `chrome://extensions` veya `edge://extensions` aç
3. **Geliştirici modu**nu aç
4. **Paketlenmemiş öğe yükle** / **Load unpacked**
5. `x-unfollowers` klasörünü seç
6. [x.com](https://x.com) hesabına giriş yap. Sağ alttaki yuvarlak düğme paneli açar. Eklenti simgesinden de açabilirsin.

## Kullanım

1. x.com açık ve girişli olsun
2. Paneli aç → **Taramayı Başlat**
3. Listeyi kontrol et. Tutmak istediklerini işaretleme. Yıldız (☆) koruma listesine ekler
4. **Aralık**ı ayarla. **30 saniye ve üzeri önerilir.** 60 saniye daha güvenli
5. **Rastgele sapma** açıksa bekleme süresi biraz oynar
6. **Seçilenleri Çıkar**. Kesmek için **Durdur**

İlk tarama boşsa veya hata verirse `https://x.com/following` sayfasını aç, biraz aşağı kaydır, taramayı tekrar başlat. X’in kendi isteği yakalanınca tarama daha sağlam çalışır.

## Güvenlik

X toplu takipten çıkarmayı sınırlar. Kısıtlama riskini azaltmak için:

- Hesaplar arasında 30 saniye veya daha fazla bekle (60+ daha güvenli)
- Bir oturumda yüzlerce kişiyi peş peşe çıkarma
- Aynı oturumda başka X otomasyonu çalıştırma

Bu eklenti X’in resmi API’si değildir. Site değişirse bozulabilir. Kendi hesabında, kendi sorumluluğunda kullan.

## Nasıl çalışır

Eklenti `x.com` / `twitter.com` üzerinde Manifest V3 içerik betiği olarak çalışır. Açık oturumunla takip listeni okur, geri takip durumunu kontrol eder, seçtiğin hesapları verdiğin aralıkla teker teker takipten çıkarır.

| Dosya | Görev |
| --- | --- |
| `page-bridge.js` | X’in kendi isteklerinden oturum başlıklarını yakalar |
| `content.js` | Panel, tarama, seçim, zamanlayıcılı çıkarma |
| `popup.html` | Eklenti simgesi menüsü |
| `background.js` | Popup’tan X sekmesi açar |

## Dil

Varsayılan GitHub belgesi Türkçe. İngilizce sürüm: [README.en.md](README.en.md). Sayfa içi panel Türkçe.

## Lisans

Kendi hesabında, kendi sorumluluğunda kullan.
