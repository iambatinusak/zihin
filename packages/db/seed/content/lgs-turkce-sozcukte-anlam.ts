import type { SeedSubjectContent } from '../types'

export const content: SeedSubjectContent = {
  examCode: 'LGS',
  subjectSlug: 'turkce',
  units: [
    {
      slug: 'sozcukte-anlam',
      topics: [
        // ─────────────────────────────────────────────────────────────
        // 1) Gerçek, Mecaz ve Terim Anlam
        // ─────────────────────────────────────────────────────────────
        {
          slug: 'gercek-mecaz-ve-terim-anlam',
          memoryNote: `## GMT Saati Tekniği

Bu üç anlamı karıştırmamak için akıllı saatlerin üzerinde yazan **GMT** kısaltmasını kullan: **G**erçek – **M**ecaz – **T**erim. Zihninde tek bir saat kadranı hayal et; kadranın üç bölmesi var ve her sözcüğü sırayla bu üç bölmeden geçiriyorsun.

**Kadranı okuma sırası (ezberlenecek üç soru):**

1. **G — "Sözlüğü açsam ilk sırada bu anlam mı yazar?"** Evet ise gerçek anlam. (*"Bardağı **kırdı**."* — elle tutulur bir kırılma var.)
2. **M — "Ortada bir benzetme, bir aktarma var mı? Anlam gerçeğinden kaymış mı?"** Evet ise mecaz anlam. (*"Sözleriyle kalbimi **kırdı**."* — ortada kırılan bir cam yok, benzetme var.)
3. **T — "Bu sözcük hangi dersin defterine yazılır?"** Matematik, müzik, dil bilgisi, tıp, edebiyat… Bir ders adı söyleyebiliyorsan terim anlamdır. (*"Sözcüğün **kök**ü 'kitap'tır."* — bu cümle dil bilgisi defterine yazılır.)

**Hikâyeleme ile pekiştirme:** Elinde bir **kök** tutan bir öğrenci düşün. Önce onu toprağa diker (**gerçek**), sonra "sorunun kökünü bulalım" diye söylenir (**mecaz**), en sonunda tahtaya gidip "kitap**lık**" sözcüğünün kökünü ayırır (**terim**). Aynı sözcüğün üç kılığa girdiğini bir kez bu şekilde canlandırırsan, sınavda "hangisinde terim anlamıyla kullanılmıştır" sorusunda şıkları tek tek denemek yerine doğrudan "hangi ders?" sorusunu sorarsın.

**En sık düşülen tuzak:** Terim anlamlı bir sözcüğün mecazlı olması gerektiğini sanmak. Terim, mecazın bir türü değildir; terim de gerçek anlamlıdır, sadece bir alana özgüleşmiştir. Kontrol listesini hep aynı sırayla — **G → M → T** — okursan bu tuzağa düşmezsin.`,
          outcomes: [
            {
              code: 'T.8.3.5',
              description:
                'Bağlamdan hareketle bilinmeyen kelime ve kelime gruplarının anlamını tahmin eder.',
              orderIndex: 0,
            },
            {
              code: 'T.8.3.5.1',
              description:
                'Okuduğu metinlerdeki kelimelerin gerçek, mecaz ve terim anlamlarını ayırt eder.',
              orderIndex: 1,
            },
            {
              code: 'T.8.3.5.2',
              description:
                'Çok anlamlı bir kelimenin cümledeki bağlamına göre kazandığı anlamı belirler.',
              orderIndex: 2,
            },
          ],
          videos: [
            {
              title: 'Gerçek, Mecaz ve Terim Anlam — Konu Anlatımı',
              type: 'lecture',
              durationSeconds: 1560,
              orderIndex: 0,
              isFreePreview: true,
              checkpoints: [
                { timestampSeconds: 520, questionIndex: 0 },
                { timestampSeconds: 1040, questionIndex: 2 },
              ],
            },
            {
              title: 'Gerçek, Mecaz ve Terim Anlam — Soru Çözümü',
              type: 'solution',
              durationSeconds: 1020,
              orderIndex: 1,
              isFreePreview: true,
              checkpoints: [
                { timestampSeconds: 340, questionIndex: 1 },
                { timestampSeconds: 680, questionIndex: 3 },
              ],
            },
          ],
          questions: [
            {
              stem: 'Aşağıdaki cümlelerin hangisinde **koyu** yazılmış sözcük mecaz anlamıyla kullanılmıştır?',
              options: [
                { key: 'A', text: 'Çocuk, elindeki **taşı** havuza attı.' },
                { key: 'B', text: 'Mutfaktaki **musluk** sabahtan beri damlıyor.' },
                { key: 'C', text: 'Müdürün **soğuk** bakışları herkesi susturdu.' },
                { key: 'D', text: 'Dolaptan iki temiz **bardak** çıkardı.' },
              ],
              correctOption: 'C',
              explanation:
                'Mecaz anlam, sözcüğün sözlükteki ilk anlamından uzaklaşıp bir benzetmeyle yeni bir anlam kazanmasıdır. C seçeneğinde bakışların ısısı ölçülemez; "soğuk" burada "ilgisiz, ürkütücü" anlamındadır, yani mecazdır. A, B ve D seçeneklerindeki taş, musluk ve bardak elle tutulan varlıkları karşıladığı için gerçek anlamlıdır. Özellikle B seçeneği "damlamak" fiili yüzünden mecaz sanılabilir, oysa gerçekten damlayan bir musluk vardır.',
              difficulty: 2,
              expectedSeconds: 45,
              tags: ['mecaz anlam', 'gerçek anlam', 'sözcükte anlam'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.1',
            },
            {
              stem: 'Aşağıdaki cümlelerin hangisinde **koyu** yazılmış sözcük terim anlamıyla kullanılmıştır?',
              options: [
                { key: 'A', text: 'Öğretmen tahtaya geniş bir **açı** çizdi.' },
                { key: 'B', text: 'Sokağın **köşesinde** bizi bekliyordu.' },
                { key: 'C', text: 'Annem çayı yeni **demledi**.' },
                { key: 'D', text: 'Onun **dili** oldukça keskindir.' },
              ],
              correctOption: 'A',
              explanation:
                'Terim, bir bilim, sanat ya da meslek dalına özgü kavramı karşılayan sözcüktür. "Açı" A seçeneğinde matematiğe ait bir kavramdır, bu yüzden terim anlamlıdır. B ve C seçeneklerindeki sözcükler günlük dilde gerçek anlamlarıyla kullanılmıştır. D seçeneğinde "dil" organ değil, "konuşma biçimi" anlamındadır; bu bir mecazdır, terim değildir.',
              difficulty: 2,
              expectedSeconds: 50,
              tags: ['terim anlam', 'mecaz anlam', 'kavram'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.1',
            },
            {
              stem: 'Aşağıdaki cümlelerin hangisinde **koyu** yazılmış sözcük gerçek anlamıyla kullanılmıştır?',
              options: [
                { key: 'A', text: 'Sınav sonucunu duyunca yüzü **güldü**.' },
                { key: 'B', text: 'Bu mağazada fiyatlar epey **tuzlu**.' },
                { key: 'C', text: 'Attığı bu haber ortalığı **karıştırdı**.' },
                { key: 'D', text: 'Aşçı, çorbayı kepçeyle **karıştırdı**.' },
              ],
              correctOption: 'D',
              explanation:
                'Gerçek anlam, sözcüğün akla ilk gelen, temel anlamıdır. D seçeneğinde kepçeyle yapılan somut bir karıştırma eylemi vardır. C seçeneğinde ise aynı fiil "ortalığı karıştırmak", yani "huzursuzluk çıkarmak" anlamında mecaza kaymıştır; aynı sözcüğün iki cümlede farklı anlamlarda geçmesi bu ayrımı görmen için konmuştur. A seçeneğinde yüz gülmez, sevinç anlatılır; B seçeneğinde fiyatın tadı olmaz, "pahalı" denmek istenmiştir.',
              difficulty: 3,
              expectedSeconds: 60,
              tags: ['gerçek anlam', 'mecaz anlam', 'çok anlamlılık'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.2',
            },
            {
              stem: '"Kök" sözcüğü aşağıdaki cümlelerin hangisinde terim anlamıyla kullanılmıştır?',
              options: [
                { key: 'A', text: 'Ağacın kökleri toprağın derinlerine inmiş.' },
                { key: 'B', text: '"Kitaplık" sözcüğünün kökü "kitap"tır.' },
                { key: 'C', text: 'Sorunun kökünü bulmadan çözüm üretemezsin.' },
                { key: 'D', text: 'Bahçıvan, çiçeğin köklerini dikkatle ayıkladı.' },
              ],
              correctOption: 'B',
              explanation:
                'B seçeneğindeki "kök", dil bilgisinin bir kavramıdır: bir sözcüğün anlamlı en küçük parçası. Bir ders adı söyleyebiliyorsan (burada dil bilgisi) sözcük terim anlamlıdır. A ve D seçeneklerinde bitkinin toprak altındaki bölümü kastedildiği için gerçek anlam vardır. C seçeneğinde "kök" sözcüğü "kaynak, temel sebep" anlamına kaydığı için mecazdır.',
              difficulty: 3,
              expectedSeconds: 55,
              tags: ['terim anlam', 'dil bilgisi', 'çok anlamlılık'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.1',
            },
            {
              stem: 'Aşağıdaki cümlelerin hangisinde mecaz anlamlı bir kullanım **yoktur**?',
              options: [
                { key: 'A', text: 'Söyledikleri kalbimi kırdı.' },
                { key: 'B', text: 'Elindeki bardağı düşürüp kırdı.' },
                { key: 'C', text: 'Onu görmeyince içim karardı.' },
                { key: 'D', text: 'Toplantı boyunca sınıfın havası ağırdı.' },
              ],
              correctOption: 'B',
              explanation:
                'B seçeneğinde bardağın düşüp parçalanması somut bir olaydır; sözcükler gerçek anlamlarıyla kullanılmıştır. A seçeneğinde kalp fiziksel olarak kırılmaz, "üzmek" anlatılır. C seçeneğinde iç kararmaz, "umutsuzlanmak" anlatılır. D seçeneğinde havanın ağırlığı tartılmaz, "gergin ortam" anlatılır; bu üçü de mecazdır.',
              difficulty: 3,
              expectedSeconds: 55,
              tags: ['mecaz anlam', 'gerçek anlam', 'olumsuz soru kökü'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.1',
            },
            {
              stem: 'Terim anlam ile ilgili aşağıdaki yargılardan hangisi **yanlıştır**?',
              options: [
                {
                  key: 'A',
                  text: 'Bir bilim, sanat ya da meslek dalına özgü kavramları karşılar.',
                },
                {
                  key: 'B',
                  text: 'Aynı sözcük bir cümlede terim, başka bir cümlede gerçek anlamlı olabilir.',
                },
                {
                  key: 'C',
                  text: 'Terimler, kullanıldıkları alanda tek ve kesin bir anlam taşır.',
                },
                {
                  key: 'D',
                  text: 'Bir sözcüğün terim anlam kazanabilmesi için önce mecazlaşması gerekir.',
                },
              ],
              correctOption: 'D',
              explanation:
                'Terim ile mecaz birbirinden bağımsız iki kavramdır; terimleşme için mecazlaşma şartı yoktur, bu yüzden D yanlıştır. "Kök" sözcüğü mecazlaşmadan doğrudan dil bilgisi terimi olabilmiştir. B doğrudur: "dal" bir cümlede ağacın dalıdır (gerçek), başka bir cümlede bilimin dalıdır (terim). C de doğrudur; terimlerin alanları içinde tek anlamlı olması, bilimsel anlatımın kesinliğini sağlar.',
              difficulty: 3,
              expectedSeconds: 65,
              tags: ['terim anlam', 'kavram bilgisi'],
              source: 'original',
              outcomeCode: 'T.8.3.5.1',
            },
            {
              stem: `Aşağıdaki cümleleri inceleyiniz:

**I.** Perde akşam saat sekizde açılacak.
**II.** Rüzgâr, açık pencerenin perdesini savuruyordu.
**III.** Gözlerinin önüne bir sis perdesi indi.

"Perde" sözcüğü numaralanmış cümlelerde sırasıyla hangi anlamlarda kullanılmıştır?`,
              options: [
                { key: 'A', text: 'Terim – Gerçek – Mecaz' },
                { key: 'B', text: 'Gerçek – Terim – Mecaz' },
                { key: 'C', text: 'Mecaz – Gerçek – Terim' },
                { key: 'D', text: 'Terim – Mecaz – Gerçek' },
              ],
              correctOption: 'A',
              explanation:
                'I. cümlede "perde" tiyatronun bölümlerini anlatan bir sahne sanatları terimidir; oyunun başlaması "perdenin açılması" ile ifade edilir. II. cümlede pencereye asılan kumaş, yani gerçek anlam vardır. III. cümlede görüşü engelleyen somut bir kumaş yoktur, "engel, örtü" anlamında mecaz kullanılmıştır. Sık yapılan hata, I. cümledeki perdeyi de kumaş sanıp "gerçek" demektir; oysa oradaki perde bir tiyatro kavramıdır.',
              difficulty: 4,
              expectedSeconds: 80,
              tags: ['terim anlam', 'mecaz anlam', 'numaralanmış cümleler'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.2',
            },
            {
              stem: '"Düşmek" sözcüğü aşağıdaki cümlelerin hangisinde "yakışmak, uygun olmak" anlamındaki mecaz kullanımıyla yer almıştır?',
              options: [
                { key: 'A', text: 'Çocuk, merdivenin son basamağından düştü.' },
                { key: 'B', text: 'Hastanın ateşi sabaha karşı düştü.' },
                { key: 'C', text: 'Büyüklerinle böyle konuşmak sana düşmez.' },
                { key: 'D', text: 'Yolda cüzdanım düşmüş, geri dönüp aradım.' },
              ],
              correctOption: 'C',
              explanation:
                'C seçeneğinde "düşmek", "birine yakışmak, uygun olmak" anlamındadır ve mecazdır. B seçeneği de mecazdır, ancak oradaki anlam "azalmak"tır; soruda istenen anlam bu değildir, en tehlikeli çeldirici budur. A ve D seçeneklerinde yerçekimiyle gerçekleşen somut bir düşme vardır, yani gerçek anlam söz konusudur.',
              difficulty: 4,
              expectedSeconds: 70,
              tags: ['mecaz anlam', 'çok anlamlılık', 'bağlam'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.2',
            },
            {
              stem: 'Aşağıdaki cümlelerin hangisinde **koyu** yazılmış sözcük terim anlamıyla kullanılmamıştır?',
              options: [
                { key: 'A', text: 'Şair, şiirin ikinci **dizesini** her kıtada yinelemiş.' },
                { key: 'B', text: 'Doktor, hastanın **nabzını** dikkatle saydı.' },
                { key: 'C', text: 'Besteci, parçanın **notalarını** yeniden düzenledi.' },
                { key: 'D', text: 'Rüzgârdan kırılan **dalları** bahçeden topladık.' },
              ],
              correctOption: 'D',
              explanation:
                'D seçeneğindeki "dal", ağacın kolu anlamındadır ve gerçek anlamlıdır; bir bilim ya da sanat dalına ait kavram değildir. A seçeneğindeki "dize" edebiyat, B seçeneğindeki "nabız" tıp, C seçeneğindeki "nota" müzik terimidir. Buradaki tuzak, "dal" sözcüğünün "bilimin dalı" gibi terim kullanımını hatırlayıp cümleye bakmadan işaretlememektir; anlamı belirleyen her zaman cümledeki bağlamdır.',
              difficulty: 4,
              expectedSeconds: 65,
              tags: ['terim anlam', 'gerçek anlam', 'bağlam'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.1',
            },
            {
              stem: `Aşağıdaki cümleleri inceleyiniz:

**I.** Gemi, gün doğarken limandan demir aldı.
**II.** Yeni gelen öğretmen sınıfa taze bir soluk getirdi.
**III.** Marangoz, kapının alt kenarını rendeledi.
**IV.** Onun kılıç gibi keskin bir zekâsı vardı.

Numaralanmış cümlelerin hangisinde yalnızca gerçek anlamlı kullanım vardır?`,
              options: [
                { key: 'A', text: 'Yalnız III' },
                { key: 'B', text: 'Yalnız I' },
                { key: 'C', text: 'I ve III' },
                { key: 'D', text: 'II ve IV' },
              ],
              correctOption: 'A',
              explanation:
                'III. cümlede marangozun rendeyle tahtayı inceltmesi somut bir eylemdir; sözcükler gerçek anlamlıdır. I. cümledeki "demir almak", "yola çıkmak" anlamında mecazlaşmış bir kullanımdır; gemide gerçekten demir bulunması sizi yanıltmasın, anlatılan asıl şey hareket etmektir. II. cümlede "taze soluk" canlılık, IV. cümlede "kılıç gibi keskin zekâ" zihin çabukluğu anlamında benzetmedir.',
              difficulty: 4,
              expectedSeconds: 85,
              tags: ['gerçek anlam', 'mecaz anlam', 'numaralanmış cümleler'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.1',
            },
            {
              stem: `Bir sözcük, ait olduğu bilim ya da sanat dalında kullanıldığında terim; günlük dilde benzetme amacıyla kullanıldığında mecaz anlam kazanır.

Buna göre "düğüm" sözcüğü aşağıdaki cümlelerin hangisinde terim anlamıyla kullanılmıştır?`,
              options: [
                { key: 'A', text: 'Ayakkabısının bağcığında sıkı bir düğüm vardı.' },
                { key: 'B', text: 'Bu meselenin düğümü yıllardır çözülemedi.' },
                { key: 'C', text: 'Öykünün düğüm bölümü ikinci sayfada başlıyor.' },
                { key: 'D', text: 'Konuşurken boğazında bir düğüm hissetti.' },
              ],
              correctOption: 'C',
              explanation:
                'Edebiyatta olay örgüsü serim, düğüm ve çözüm bölümlerinden oluşur; C seçeneğindeki "düğüm" bu edebiyat terimidir. A seçeneğinde bağcığa atılan somut düğüm, yani gerçek anlam vardır. B seçeneğinde "çözülmesi güç sorun", D seçeneğinde "heyecandan boğazın tıkanması" anlatıldığı için bu ikisi mecazdır. B seçeneği "çözülmek" fiiliyle birlikte geldiği için terim sanılabilir, oysa ortada bir bilim ya da sanat alanı yoktur.',
              difficulty: 5,
              expectedSeconds: 95,
              tags: ['terim anlam', 'edebiyat terimi', 'mecaz anlam'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.2',
            },
            {
              stem: 'Aşağıdaki cümlelerin hangisinde **koyu** yazılmış sözcükler sırasıyla gerçek ve mecaz anlamlıdır?',
              options: [
                { key: 'A', text: '**Ağır** yükü **taşıyan** işçi bir süre dinlendi.' },
                { key: 'B', text: '**Sıcak** çorbayı içince yüzündeki **buz** çözüldü.' },
                { key: 'C', text: '**Tatlı** sözleriyle odanın **soğuk** havasını değiştirdi.' },
                { key: 'D', text: '**Keskin** bıçakla ekmeği ikiye **böldü**.' },
              ],
              correctOption: 'B',
              explanation:
                'B seçeneğinde "sıcak" çorbanın gerçek ısısını bildirir, "buz" ise yüzdeki gerçek bir buzu değil, soğuk ve mesafeli ifadeyi anlatır; sıra tam olarak gerçek–mecazdır. A ve D seçeneklerinde her iki sözcük de gerçek anlamlıdır. C seçeneğinde "tatlı söz" ve "soğuk hava" ikisi de mecazdır, bu yüzden istenen sıra tutmaz. Soruda "sırasıyla" ifadesi olduğu için önce hangi sözcüğün geldiğine de dikkat etmelisin.',
              difficulty: 5,
              expectedSeconds: 100,
              tags: ['gerçek anlam', 'mecaz anlam', 'sıralama'],
              source: 'original',
              outcomeCode: 'T.8.3.5.1',
            },
          ],
          flashcards: [
            {
              front: 'Gerçek anlam nedir?',
              back: 'Sözcüğün akla ilk gelen, sözlükteki temel anlamıdır. Örnek: "Bardağı **kırdı**."',
            },
            {
              front: 'Mecaz anlam nedir?',
              back: 'Sözcüğün gerçek anlamından uzaklaşıp benzetme yoluyla kazandığı yeni anlamdır. Örnek: "Sözleriyle kalbimi **kırdı**."',
            },
            {
              front: 'Terim anlam nedir?',
              back: 'Bir bilim, sanat ya da meslek dalına özgü kavramı karşılayan anlamdır. Örnek: "Üçgenin **açıları**."',
            },
            {
              front: 'Terim anlamlı sözcüğü bulmanın pratik yolu nedir?',
              back: '"Bu cümle hangi dersin defterine yazılır?" diye sor. Bir ders adı söyleyebiliyorsan sözcük terim anlamlıdır.',
            },
            {
              front: 'Terim anlam ile mecaz anlam arasındaki temel fark nedir?',
              back: 'Terimde benzetme yoktur; sözcük bir alana özgüleşmiştir. Mecazda ise anlam benzetmeyle gerçeğinden kaymıştır.',
            },
          ],
        },

        // ─────────────────────────────────────────────────────────────
        // 2) Somut ve Soyut Anlam
        // ─────────────────────────────────────────────────────────────
        {
          slug: 'somut-ve-soyut-anlam',
          memoryNote: `## Beş Parmak Testi

Somut mu soyut mu ayrımında tek bir araç yeter: **elini kaldır ve beş parmağını say**. Her parmak bir duyu organıdır ve akrostişi şudur: **G**ör – **D**okun – **D**uy – **K**okla – **T**at. Bu beş harfi "**G**üneşte **D**ondurma **D**üşürdüm, **K**arınca **T**opladı" cümlesiyle ezberleyebilirsin; cümledeki ilk harfler tam olarak beş duyunun sırasını verir.

**Kullanımı:** Sözcüğü beş parmağa tek tek sor. *Rüzgâr*ı görebilir misin? Belki değil, ama **dokunabilirsin ve duyabilirsin** — en az bir parmak "evet" dediği için rüzgâr **somuttur**. *Sevgi*yi göremezsin, dokunamazsın, duyamazsın, koklayamazsın, tadamazsın — beş parmak da "hayır" der, demek ki **soyuttur**. Kural nettir: **tek bir "evet" bile yeterlidir**; hepsi "hayır" ise sözcük soyuttur.

**Somutlaştırma için zihin resmi:** Soyut bir kavramın somut bir varlık gibi anlatılmasına *somutlaştırma* denir. Bunu aklında tutmak için "sırtında çuval taşıyan bir insan" resmi kur; çuvalın üstünde **"YALNIZLIK"** yazıyor. Yalnızlık tartılamaz ama cümlede sırtta taşınan bir yüke dönüşmüştür: *"Yalnızlığını omuzlarında taşıyordu."* Sınavda somutlaştırma sorusu gördüğünde bu çuvalı hatırla ve "soyut kavram burada elle tutulur hâle gelmiş mi?" diye sor.

**Sık düşülen tuzak:** Görünmeyen her şeyi soyut sanmak. Ses, koku, hava ve rüzgâr görünmez ama duyularla algılandığı için **somuttur**; buna karşılık *özgürlük, adalet, korku, düşünce* algılanamadığı için soyuttur. Beş Parmak Testi'ni her seferinde aynı sırayla uygularsan bu tuzağa düşmezsin.`,
          outcomes: [
            {
              code: 'T.8.3.5',
              description:
                'Bağlamdan hareketle bilinmeyen kelime ve kelime gruplarının anlamını tahmin eder.',
              orderIndex: 0,
            },
            {
              code: 'T.8.3.5.3',
              description:
                'Okuduğu metinlerdeki kelimelerin somut ve soyut anlamlarını ayırt eder.',
              orderIndex: 1,
            },
            {
              code: 'T.8.3.5.4',
              description:
                'Metinde soyut kavramların somutlaştırılarak anlatıldığı kullanımları belirler.',
              orderIndex: 2,
            },
          ],
          videos: [
            {
              title: 'Somut ve Soyut Anlam — Konu Anlatımı',
              type: 'lecture',
              durationSeconds: 1180,
              orderIndex: 0,
              isFreePreview: true,
              checkpoints: [
                { timestampSeconds: 390, questionIndex: 0 },
                { timestampSeconds: 790, questionIndex: 3 },
              ],
            },
            {
              title: 'Somut ve Soyut Anlam — Soru Çözümü',
              type: 'solution',
              durationSeconds: 820,
              orderIndex: 1,
              isFreePreview: true,
              checkpoints: [
                { timestampSeconds: 270, questionIndex: 1 },
                { timestampSeconds: 545, questionIndex: 2 },
              ],
            },
          ],
          questions: [
            {
              stem: 'Aşağıdaki sözcüklerden hangisi soyut anlamlıdır?',
              options: [
                { key: 'A', text: 'taş' },
                { key: 'B', text: 'sevgi' },
                { key: 'C', text: 'kalem' },
                { key: 'D', text: 'rüzgâr' },
              ],
              correctOption: 'B',
              explanation:
                'Soyut sözcükler beş duyudan hiçbiriyle algılanamayan kavramları karşılar; "sevgi" görülemez, dokunulamaz, koklanamaz. A ve C seçeneklerindeki taş ve kalem elle tutulur varlıklardır. D seçeneği en tehlikeli çeldiricidir: rüzgâr görünmez ama tenimizde hissedilir ve sesi duyulur, bu yüzden somuttur.',
              difficulty: 2,
              expectedSeconds: 35,
              tags: ['soyut anlam', 'somut anlam', 'sözcükte anlam'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.3',
            },
            {
              stem: 'Aşağıdaki cümlelerin hangisinde soyut anlamlı bir sözcük **yoktur**?',
              options: [
                { key: 'A', text: 'Zor günlerde bile umudunu hiç yitirmedi.' },
                { key: 'B', text: 'Çocukluğundan beri büyük bir hayali vardı.' },
                { key: 'C', text: 'Sahneye çıkmadan önce korkusunu yendi.' },
                { key: 'D', text: 'Masanın üstüne iki bardak su koydu.' },
              ],
              correctOption: 'D',
              explanation:
                'D seçeneğindeki masa, bardak ve su duyularla algılanabilen varlıklardır; cümlede soyut sözcük yoktur. A seçeneğindeki "umut", B seçeneğindeki "hayal", C seçeneğindeki "korku" ise algılanamayan kavramlardır. C seçeneğindeki "yenmek" fiili somut bir mücadele çağrıştırsa da nesnesi olan "korku" soyut kaldığı için cümle elenir.',
              difficulty: 2,
              expectedSeconds: 45,
              tags: ['soyut anlam', 'somut anlam', 'olumsuz soru kökü'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.3',
            },
            {
              stem: `Soyut bir kavramın, elle tutulup gözle görülebilen bir varlık gibi anlatılmasına **somutlaştırma** denir.

Buna göre aşağıdaki cümlelerin hangisinde somutlaştırma yapılmıştır?`,
              options: [
                { key: 'A', text: 'Sevincim avuçlarımdan taşıyordu.' },
                { key: 'B', text: 'Bahçedeki güller bu sabah açmış.' },
                { key: 'C', text: 'Yağmur, akşamdan beri cama vuruyor.' },
                { key: 'D', text: 'Çantasını omzuna alıp evden çıktı.' },
              ],
              correctOption: 'A',
              explanation:
                'A seçeneğinde soyut bir duygu olan "sevinç", avuçtan taşabilen bir sıvı gibi anlatılarak somutlaştırılmıştır. B, C ve D seçeneklerinde zaten somut varlıklar (gül, yağmur, çanta) somut biçimde anlatıldığı için somutlaştırmadan söz edilemez. Somutlaştırmada temel şart, başlangıçta soyut bir kavramın bulunmasıdır.',
              difficulty: 3,
              expectedSeconds: 55,
              tags: ['somutlaştırma', 'soyut anlam', 'anlatım'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.4',
            },
            {
              stem: 'Aşağıdaki cümlelerin hangisinde **koyu** yazılmış sözcük somut anlamlıdır?',
              options: [
                { key: 'A', text: '**Özgürlük**, insanın en temel hakkıdır.' },
                { key: 'B', text: 'Onun **dürüstlüğüne** her zaman güvenirim.' },
                { key: 'C', text: 'Duvardaki **saat** dün akşamdan beri durmuş.' },
                { key: 'D', text: 'Bu işte **başarı** şansımız oldukça düşük.' },
              ],
              correctOption: 'C',
              explanation:
                'C seçeneğindeki "saat" duvarda asılı, görülüp dokunulabilen bir nesnedir; somuttur. A seçeneğindeki özgürlük, B seçeneğindeki dürüstlük ve D seçeneğindeki başarı beş duyuyla algılanamayan kavramlardır. "Saat" sözcüğü zaman ölçüsü anlamında kullanılsaydı soyut olabilirdi; anlamı belirleyen cümledeki bağlamdır.',
              difficulty: 3,
              expectedSeconds: 45,
              tags: ['somut anlam', 'soyut anlam', 'bağlam'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.3',
            },
            {
              stem: '"Yol" sözcüğü aşağıdaki cümlelerin hangisinde soyut anlamda kullanılmıştır?',
              options: [
                { key: 'A', text: 'Köyün yolu geçen yaz asfaltlandı.' },
                { key: 'B', text: 'Yolda küçük bir kaza olmuş.' },
                { key: 'C', text: 'Bu sorunu çözmenin başka bir yolu daha var.' },
                { key: 'D', text: 'Arabasını yolun kenarına park etti.' },
              ],
              correctOption: 'C',
              explanation:
                'C seçeneğinde "yol", üzerinde yürünen bir zemin değil, "yöntem, çözüm biçimi" anlamındadır ve algılanamaz; bu yüzden soyuttur. A, B ve D seçeneklerinde asfaltlanan, üzerinde kaza olan, kenarına park edilen fiziksel bir yol vardır. Bu soru, somut bir sözcüğün bağlama göre soyutlaşabildiğini gösterir.',
              difficulty: 3,
              expectedSeconds: 60,
              tags: ['soyut anlam', 'bağlam', 'çok anlamlılık'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.3',
            },
            {
              stem: 'Somut ve soyut anlamla ilgili aşağıdaki bilgilerden hangisi **yanlıştır**?',
              options: [
                { key: 'A', text: 'Soyut anlamlı sözcükler hiçbir şekilde somut anlam kazanamaz.' },
                {
                  key: 'B',
                  text: 'Somut anlamlı sözcükler beş duyudan en az biriyle algılanabilen varlıkları karşılar.',
                },
                { key: 'C', text: '"Sevgi, korku, düşünce" soyut anlamlı sözcüklere örnektir.' },
                { key: 'D', text: 'Somut anlamlı bir sözcük cümlede soyut bir anlam kazanabilir.' },
              ],
              correctOption: 'A',
              explanation:
                'A yanlıştır: soyut kavramlar somutlaştırma yoluyla elle tutulur gibi anlatılabilir; "Umutlarını rüzgâra savurdu." cümlesi buna örnektir. B, somut sözcüğün tanımını doğru verir. D de doğrudur; "yol" sözcüğü "yöntem" anlamına geldiğinde soyutlaşır. Bu soruda tuzak, "asla, hiçbir şekilde" gibi kesin ifadelerin çoğu zaman yanlış yargı taşıdığını fark etmemektir.',
              difficulty: 3,
              expectedSeconds: 70,
              tags: ['somut anlam', 'soyut anlam', 'kavram bilgisi'],
              source: 'original',
              outcomeCode: 'T.8.3.5.3',
            },
            {
              stem: `Aşağıdaki cümleleri inceleyiniz:

**I.** Yüreğinde kocaman bir yara taşıyordu.
**II.** Dizindeki yara henüz iyileşmemişti.
**III.** Acısını yıllarca içine gömdü.
**IV.** Bahçedeki çukura tohumları gömdü.

Numaralanmış cümlelerin hangilerinde somut anlamlı bir sözcük soyut anlamda kullanılmıştır?`,
              options: [
                { key: 'A', text: 'I ve II' },
                { key: 'B', text: 'I ve III' },
                { key: 'C', text: 'II ve IV' },
                { key: 'D', text: 'III ve IV' },
              ],
              correctOption: 'B',
              explanation:
                'I. cümlede "yara" tende değil yürektedir; somut bir sözcük "derin üzüntü" anlamında soyutlaşmıştır. III. cümlede "gömmek" toprakla ilgili somut bir eylemken burada "duyguyu bastırmak" anlamına gelerek soyutlaşmıştır. II ve IV. cümlelerde ise aynı sözcükler gerçek, somut anlamlarıyla kullanılmıştır; sorunun kurgusu tam olarak bu ikili karşılaştırmaya dayanır.',
              difficulty: 4,
              expectedSeconds: 85,
              tags: ['soyutlaşma', 'somut anlam', 'numaralanmış cümleler'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.4',
            },
            {
              stem: 'Aşağıdaki cümlelerin hangisinde soyut anlamlı bir sözcük somutlaştırılmamıştır?',
              options: [
                { key: 'A', text: 'Öfkesi burnundan geliyordu.' },
                { key: 'B', text: 'Yıllar sonra sabrı taştı.' },
                { key: 'C', text: 'Kurduğu hayaller bir bir yıkıldı.' },
                { key: 'D', text: 'Bahçemizin duvarı dün geceki fırtınada yıkıldı.' },
              ],
              correctOption: 'D',
              explanation:
                'D seçeneğinde yıkılan şey somut bir duvardır; ortada soyut bir kavram olmadığı için somutlaştırma da yoktur. A seçeneğinde soyut olan "öfke" akan bir maddeye, B seçeneğinde "sabır" taşan bir sıvıya, C seçeneğinde "hayaller" yıkılan bir yapıya benzetilmiştir. C ile D aynı fiili paylaştığı için ayrımı yapan şey fiil değil, öznenin soyut mu somut mu olduğudur.',
              difficulty: 4,
              expectedSeconds: 75,
              tags: ['somutlaştırma', 'soyut anlam', 'olumsuz soru kökü'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.4',
            },
            {
              stem: 'Aşağıdaki cümlelerin hangisinde birden fazla soyut anlamlı sözcük kullanılmıştır?',
              options: [
                { key: 'A', text: 'Sevgi ve saygı, dostluğun temelidir.' },
                { key: 'B', text: 'Kapıdaki çocuk elindeki topu yere bıraktı.' },
                { key: 'C', text: 'Masadaki kitabı alıp odasına girdi.' },
                { key: 'D', text: 'Yağmur, çatıdaki kiremitleri iyice ıslattı.' },
              ],
              correctOption: 'A',
              explanation:
                'A seçeneğinde "sevgi", "saygı" ve "dostluk" olmak üzere üç soyut sözcük vardır. B, C ve D seçeneklerindeki çocuk, top, kitap, oda, yağmur ve kiremit duyularla algılanabilen varlıklardır. "Temel" sözcüğü burada binanın temeli değil, "dayanak" anlamındadır ve o da soyuttur; bu, doğru seçeneği daha da güçlendirir.',
              difficulty: 4,
              expectedSeconds: 60,
              tags: ['soyut anlam', 'sözcük sayısı', 'somut anlam'],
              source: 'original',
              outcomeCode: 'T.8.3.5.3',
            },
            {
              stem: '"Ağır" sözcüğü aşağıdaki cümlelerin hangisinde soyut bir kavramı nitelemiştir?',
              options: [
                { key: 'A', text: 'Ağır çantasını zar zor üst kata çıkardı.' },
                { key: 'B', text: 'Küçük yaşta ağır bir sorumluluk yüklenmişti.' },
                { key: 'C', text: 'Ağır kutuyu masanın üstüne bıraktı.' },
                { key: 'D', text: 'Ağır adımlarla kapıya doğru yürüdü.' },
              ],
              correctOption: 'B',
              explanation:
                'B seçeneğinde nitelenen "sorumluluk" tartılamayan, algılanamayan bir kavramdır; dolayısıyla "ağır" burada soyut bir kavramı nitelemiştir. A ve C seçeneklerinde çanta ve kutu gerçekten kilogramla ölçülebilir, yani somuttur. D seçeneği çeldirici olarak konmuştur: "ağır adım" yavaşlığı anlatsa da nitelenen "adım" gözle görülebilen bir harekettir.',
              difficulty: 4,
              expectedSeconds: 70,
              tags: ['soyut anlam', 'niteleme', 'bağlam'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.3',
            },
            {
              stem: `Somutlaştırma, anlatıma canlılık katmak amacıyla soyut kavramların elle tutulur, gözle görülür hâle getirilmesidir.

Buna göre aşağıdaki cümlelerin hangisinde somutlaştırmaya başvurulmamıştır?`,
              options: [
                { key: 'A', text: 'Bütün umutlarını rüzgâra savurdu.' },
                { key: 'B', text: 'Yalnızlığını omuzlarında bir yük gibi taşıyordu.' },
                { key: 'C', text: 'Korkusunu kapının önünde bırakıp içeri girdi.' },
                { key: 'D', text: 'Çocuk, oyuncaklarını tek tek sandığa yerleştirdi.' },
              ],
              correctOption: 'D',
              explanation:
                'D seçeneğinde hem oyuncak hem sandık somut varlıklardır; soyuttan somuta geçen bir anlatım yoktur. A seçeneğinde "umut" savrulabilen bir maddeye, B seçeneğinde "yalnızlık" omuzda taşınan bir yüke, C seçeneğinde "korku" kapı önüne bırakılabilen bir eşyaya dönüştürülmüştür. Somutlaştırmada aranan tek şart, çıkış noktasının soyut bir kavram olmasıdır.',
              difficulty: 5,
              expectedSeconds: 90,
              tags: ['somutlaştırma', 'soyut anlam', 'anlatım'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.4',
            },
            {
              stem: '"Karanlık" sözcüğü aşağıdaki cümlelerin hangisinde soyut anlamıyla kullanılmıştır?',
              options: [
                { key: 'A', text: 'Karanlık sokakta yürümekten çekiniyordu.' },
                { key: 'B', text: 'Odanın karanlığında hiçbir şey seçemedi.' },
                { key: 'C', text: 'Geleceğe dair karanlık düşünceleri vardı.' },
                { key: 'D', text: 'Akşamüstü gökyüzü birden karanlık oldu.' },
              ],
              correctOption: 'C',
              explanation:
                'C seçeneğinde "karanlık", ışık yokluğunu değil "kötümser, umutsuz" olmayı anlatır; nitelenen "düşünce" de zaten soyut olduğundan sözcük soyut anlamdadır. A, B ve D seçeneklerinde ışığın azlığı gözle algılanabildiği için somut bir durum söz konusudur. Buradaki tuzak, karanlığın görünmez sanılmasıdır; oysa karanlık gözle algılanan bir durumdur ve somut sayılır.',
              difficulty: 5,
              expectedSeconds: 95,
              tags: ['soyut anlam', 'somut anlam', 'bağlam'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.3',
            },
          ],
          flashcards: [
            {
              front: 'Somut anlamlı sözcük nedir?',
              back: 'Beş duyudan en az biriyle algılanabilen varlıkları karşılayan sözcüktür: taş, su, rüzgâr, koku.',
            },
            {
              front: 'Soyut anlamlı sözcük nedir?',
              back: 'Duyularla algılanamayan, yalnızca zihinde var olan kavramları karşılayan sözcüktür: sevgi, korku, adalet.',
            },
            {
              front: '"Rüzgâr" somut mu, soyut mu?',
              back: 'Somuttur. Görülmese de tende hissedilir ve sesi duyulur; bir duyuyla algılanması yeterlidir.',
            },
            {
              front: 'Somutlaştırma nedir?',
              back: 'Soyut bir kavramın elle tutulur, gözle görülür bir varlık gibi anlatılmasıdır. Örnek: "Yalnızlığını omuzlarında taşıyordu."',
            },
            {
              front: 'Somut bir sözcük soyutlaşabilir mi?',
              back: 'Evet, bağlama göre soyutlaşır. "Yolun kenarı" somut, "sorunu çözmenin yolu" soyuttur.',
            },
          ],
        },

        // ─────────────────────────────────────────────────────────────
        // 3) Sözcükler Arasındaki Anlam İlişkileri
        // ─────────────────────────────────────────────────────────────
        {
          slug: 'sozcukler-arasindaki-anlam-iliskileri',
          memoryNote: `## "Eski Ziyaretçi Sessizce Yanıma Geldi" Akrostişi

Bu konuda karıştırılan beş ilişki vardır ve hepsinin baş harfi tek bir cümlede saklıdır: **E**ski **Z**iyaretçi **S**essizce **Y**anıma **G**eldi.

- **E → Eş anlamlılık:** Farklı sesler, aynı kavram. *okul – mektep, siyah – kara, armağan – hediye.*
- **Z → Zıt anlamlılık:** Birbirinin karşıtı olan kavramlar. *gelmek – gitmek, uzun – kısa.*
- **S → Sesteşlik (eş seslilik):** Yazılışı aynı, anlamları arasında **hiçbir akrabalık olmayan** sözcükler. *yaz* (mevsim) – *yaz* (yazmak).
- **Y → Yakın anlamlılık:** Anlamları örtüşür ama tam olarak birbirinin yerini tutmaz. *dilek – istek, göç etmek – taşınmak.*
- **G → Genel–özel ilişkisi:** Biri diğerini kapsar. *varlık > canlı > hayvan > kedi.*

**İki büyük tuzak ve panzehiri:** Birincisi, olumsuzluğu zıtlıkla karıştırmaktır; *gitmek*in zıddı "gitmemek" değil **gelmek**tir. Kendine "olumsuzluk eki mi ekledim, yoksa karşıt kavramı mı buldum?" diye sor. İkincisi, sesteşi çok anlamlılıkla karıştırmaktır; burada **akrabalık testi** uygula: *ağacın dalı* ile *bilimin dalı* arasında "kola benzer uzantı" akrabalığı vardır, bu yüzden çok anlamlılıktır; *gül* çiçeği ile *gül* buyruğu arasında ise hiçbir akrabalık yoktur, bu yüzden sesteştir.

**Genel–özel için merdiven resmi:** Zihninde bir merdiven canlandır; en üst basamakta *varlık*, en altta *kedi* durur ve aşağı indikçe kapsam daralır. Soruda "hangisi diğerlerini kapsar" dendiğinde merdivenin en üst basamağını, "genelden özele sıralanmıştır" dendiğinde ise merdivenin yukarıdan aşağı okunduğunu hatırla. Bu resim, seçeneklerdeki sıralamanın yönünü şaşırmanı engeller.`,
          outcomes: [
            {
              code: 'T.8.3.5',
              description:
                'Bağlamdan hareketle bilinmeyen kelime ve kelime gruplarının anlamını tahmin eder.',
              orderIndex: 0,
            },
            {
              code: 'T.8.3.5.5',
              description:
                'Kelimeler arasındaki eş anlamlılık, zıt anlamlılık ve eş seslilik ilişkilerini belirler.',
              orderIndex: 1,
            },
            {
              code: 'T.8.3.5.6',
              description:
                'Kelimeler arasındaki yakın anlamlılık ve genel-özel anlam ilişkilerini açıklar.',
              orderIndex: 2,
            },
          ],
          videos: [
            {
              title: 'Sözcükler Arasındaki Anlam İlişkileri — Konu Anlatımı',
              type: 'lecture',
              durationSeconds: 1440,
              orderIndex: 0,
              isFreePreview: true,
              checkpoints: [
                { timestampSeconds: 480, questionIndex: 0 },
                { timestampSeconds: 960, questionIndex: 2 },
              ],
            },
            {
              title: 'Sözcükler Arasındaki Anlam İlişkileri — Soru Çözümü',
              type: 'solution',
              durationSeconds: 960,
              orderIndex: 1,
              isFreePreview: true,
              checkpoints: [
                { timestampSeconds: 320, questionIndex: 1 },
                { timestampSeconds: 640, questionIndex: 3 },
              ],
            },
          ],
          questions: [
            {
              stem: 'Aşağıdaki sözcük çiftlerinden hangisi eş anlamlıdır?',
              options: [
                { key: 'A', text: 'uzun – kısa' },
                { key: 'B', text: 'yüz (surat) – yüz (sayı)' },
                { key: 'C', text: 'sıcak – soğuk' },
                { key: 'D', text: 'kırmızı – al' },
              ],
              correctOption: 'D',
              explanation:
                'Eş anlamlı sözcükler farklı seslerle aynı kavramı karşılar; "kırmızı" ile "al" aynı rengi anlatır. A ve C seçeneklerindeki çiftler birbirinin karşıtıdır, yani zıt anlamlıdır. B seçeneğinde ise yazılışı aynı, anlamları arasında hiçbir bağ olmayan iki sözcük vardır; bu eş anlamlılık değil sesteşliktir.',
              difficulty: 2,
              expectedSeconds: 35,
              tags: ['eş anlamlılık', 'zıt anlamlılık', 'sesteşlik'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.5',
            },
            {
              stem: 'Aşağıdaki cümlelerin hangisinde zıt anlamlı sözcükler bir arada kullanılmıştır?',
              options: [
                { key: 'A', text: 'Bugün hava sabahtan beri çok güzeldi.' },
                { key: 'B', text: 'Kitabı okuyup yerine, rafa kaldırdı.' },
                { key: 'C', text: 'Bu evde yazın sıcağı, kışın soğuğu belli olmaz.' },
                { key: 'D', text: 'Sabah erkenden yola çıkmayı planlıyoruz.' },
              ],
              correctOption: 'C',
              explanation:
                'C seçeneğinde hem "yaz – kış" hem "sıcak – soğuk" olmak üzere iki zıt anlamlı çift bulunur. A ve D seçeneklerinde karşıtlık kuran ikinci bir sözcük yoktur. B seçeneği tuzaktır: "okumak" ile "kaldırmak" farklı eylemlerdir ama birbirinin karşıtı değildir; zıtlık için anlamların birbirini olumsuzlaması gerekir.',
              difficulty: 2,
              expectedSeconds: 45,
              tags: ['zıt anlamlılık', 'sözcükte anlam'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.5',
            },
            {
              stem: 'Aşağıdaki cümlelerin hangisinde sesteş (eş sesli) bir sözcük kullanılmıştır?',
              options: [
                { key: 'A', text: 'Kapının önünde uzun süre bekledi.' },
                { key: 'B', text: 'Bu yaz bütün ailece köye gideceğiz.' },
                { key: 'C', text: 'Annesine çok güzel bir hediye aldı.' },
                { key: 'D', text: 'Sabah kahvaltısını acele etmeden yaptı.' },
              ],
              correctOption: 'B',
              explanation:
                'B seçeneğindeki "yaz" mevsim adıdır; aynı yazılışa sahip "yaz" (yazmak fiilinin emri) ile arasında hiçbir anlam akrabalığı yoktur, dolayısıyla sesteştir. A, C ve D seçeneklerindeki "kapı", "hediye" ve "sabah" sözcüklerinin eş sesli karşılıkları bulunmaz. Sesteşlikte aranan şart, yazılışın aynı, anlamların tamamen ilgisiz olmasıdır.',
              difficulty: 3,
              expectedSeconds: 55,
              tags: ['sesteşlik', 'eş seslilik', 'sözcükte anlam'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.5',
            },
            {
              stem: 'Aşağıdaki sözcüklerden hangisi diğerlerini anlamca kapsar?',
              options: [
                { key: 'A', text: 'çiçek' },
                { key: 'B', text: 'gül' },
                { key: 'C', text: 'papatya' },
                { key: 'D', text: 'lale' },
              ],
              correctOption: 'A',
              explanation:
                'Gül, papatya ve lale birer çiçek türüdür; "çiçek" bunların üçünü de içine alan genel kavramdır. Genel–özel ilişkisinde kapsayan sözcük merdivenin üst basamağında durur. B seçeneğindeki "gül" sesteş olduğu için dikkat çekebilir, ancak soruda sorulan şey kapsam ilişkisidir, sesteşlik değildir.',
              difficulty: 3,
              expectedSeconds: 40,
              tags: ['genel-özel ilişkisi', 'kapsam'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.6',
            },
            {
              stem: 'Aşağıdaki sözcük çiftlerinden hangisi eş anlamlı değil, yakın anlamlıdır?',
              options: [
                { key: 'A', text: 'siyah – kara' },
                { key: 'B', text: 'okul – mektep' },
                { key: 'C', text: 'armağan – hediye' },
                { key: 'D', text: 'dilek – istek' },
              ],
              correctOption: 'D',
              explanation:
                'D seçeneğindeki "dilek" ile "istek" birbirine çok yakındır ama her yerde birbirinin yerini tutmaz; "dilek" daha çok gerçekleşmesi umut edilen bir temenniyi anlatır. Bu nedenle aralarındaki ilişki yakın anlamlılıktır. A, B ve C seçeneklerindeki çiftler ise aynı kavramı karşılayan tam eş anlamlılardır. Ayrımı yaparken "birini çıkarıp diğerini koyunca cümlenin anlamı hiç değişmiyor mu?" diye sormalısın.',
              difficulty: 3,
              expectedSeconds: 65,
              tags: ['yakın anlamlılık', 'eş anlamlılık', 'nüans'],
              source: 'original',
              outcomeCode: 'T.8.3.5.6',
            },
            {
              stem: `Bir sözcüğün olumsuz biçimi ile zıt anlamlısı aynı şey değildir.

Buna göre "gitmek" sözcüğünün zıt anlamlısı aşağıdakilerden hangisidir?`,
              options: [
                { key: 'A', text: 'gitmemek' },
                { key: 'B', text: 'gelmek' },
                { key: 'C', text: 'yürümek' },
                { key: 'D', text: 'durmak' },
              ],
              correctOption: 'B',
              explanation:
                '"Gitmek" uzaklaşmayı, "gelmek" ise yaklaşmayı anlatır; ikisi yönü tam ters olan karşıt kavramlardır. A seçeneği yalnızca fiilin olumsuzudur, olumsuzluk eki almak zıt anlamlı yapmaz. C seçeneğindeki "yürümek" bir hareket biçimidir, karşıtlık kurmaz. D seçeneğindeki "durmak" ise "yürümek" ya da "hareket etmek" fiilinin karşıtı olabilir, "gitmek"in değil.',
              difficulty: 3,
              expectedSeconds: 50,
              tags: ['zıt anlamlılık', 'olumsuzluk', 'tuzak'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.5',
            },
            {
              stem: 'Aşağıdaki cümlelerin hangisinde hem eş anlamlı hem zıt anlamlı sözcükler bir arada bulunmaktadır?',
              options: [
                { key: 'A', text: 'Ak saçlı dedem bahçede oturmuş bizi bekliyordu.' },
                { key: 'B', text: 'Beyaz gömleğini giydi, siyah pantolonunu ütüledi.' },
                { key: 'C', text: 'Siyahla beyazı ayıramayan, karayla akı hiç göremez.' },
                { key: 'D', text: 'Kara bulutlar dağın ardından hızla yaklaşıyordu.' },
              ],
              correctOption: 'C',
              explanation:
                'C seçeneğinde "siyah – kara" ve "beyaz – ak" eş anlamlı çiftleri, "siyah – beyaz" ve "kara – ak" ise zıt anlamlı çiftleri oluşturur; her iki ilişki de tek cümlede bulunur. B seçeneğinde yalnızca zıtlık vardır, eş anlamlı bir çift yoktur. A ve D seçeneklerinde ise tek bir renk sözcüğü geçtiği için hiçbir ilişki kurulamaz.',
              difficulty: 4,
              expectedSeconds: 80,
              tags: ['eş anlamlılık', 'zıt anlamlılık', 'çoklu ilişki'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.5',
            },
            {
              stem: `Sesteş sözcükler yazılışı aynı olan, ancak anlamları arasında hiçbir ilgi bulunmayan sözcüklerdir.

Buna göre aşağıdaki cümle çiftlerinin hangisinde **koyu** yazılmış sözcükler sesteş **değildir**?`,
              options: [
                {
                  key: 'A',
                  text: 'Ağacın **dalı** rüzgârda kırıldı. / Matematik, bilimin bir **dalıdır**.',
                },
                {
                  key: 'B',
                  text: 'Bahçedeki **güller** açmış. / Biraz **gül** de yüzün aydınlansın.',
                },
                {
                  key: 'C',
                  text: '**Yüzümü** sabunla yıkadım. / Kumbarasında tam **yüz** lira varmış.',
                },
                { key: 'D', text: 'Bu **yaz** tatile gideceğiz. / Adını deftere **yaz**.' },
              ],
              correctOption: 'A',
              explanation:
                'A seçeneğinde ağacın dalı ile bilimin dalı arasında "gövdeden ayrılan uzantı" benzerliği vardır; anlamlar akraba olduğu için bu çok anlamlılıktır, sesteşlik değildir. B, C ve D seçeneklerinde ise sözcüklerin anlamları arasında hiçbir bağ yoktur: çiçek ile gülmek, surat ile sayı, mevsim ile yazma eylemi. Sesteşliği ayırt etmek için "iki anlam akraba mı?" testini uygula.',
              difficulty: 4,
              expectedSeconds: 90,
              tags: ['sesteşlik', 'çok anlamlılık', 'ayırt etme'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.5',
            },
            {
              stem: `"varlık – canlı – hayvan – kedi" sıralaması genelden özele doğru yapılmıştır.

Buna göre aşağıdaki sıralamalardan hangisi bu ilişkiye uygundur?`,
              options: [
                { key: 'A', text: 'elma – meyve – bitki – varlık' },
                { key: 'B', text: 'taşıt – kara taşıtı – otomobil – sedan' },
                { key: 'C', text: 'İstanbul – şehir – ülke – kıta' },
                { key: 'D', text: 'roman – kitap – edebiyat – sanat' },
              ],
              correctOption: 'B',
              explanation:
                'B seçeneğinde kapsam her adımda daralır: taşıtların bir bölümü kara taşıtıdır, kara taşıtlarının bir türü otomobildir, otomobillerin bir tipi sedandır. A, C ve D seçenekleri de kapsam ilişkisi taşır, ancak sıralama özelden genele doğrudur; yani yön terstir. Soruda örnek sıralamanın yönü verildiği için seçenekleri işaretlemeden önce mutlaka yönü kontrol etmelisin.',
              difficulty: 4,
              expectedSeconds: 85,
              tags: ['genel-özel ilişkisi', 'sıralama', 'kapsam'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.6',
            },
            {
              stem: `Bir sözcüğün zıt anlamlısı, kullanıldığı bağlama göre değişebilir.

Buna göre "Öğretmen, çocuğun **doğru** davranışını takdir etti." cümlesindeki "doğru" sözcüğünün zıt anlamlısı aşağıdakilerden hangisidir?`,
              options: [
                { key: 'A', text: 'eğri' },
                { key: 'B', text: 'ters' },
                { key: 'C', text: 'yanlış' },
                { key: 'D', text: 'uzak' },
              ],
              correctOption: 'C',
              explanation:
                'Cümlede "doğru" bir davranışı nitelemekte ve "kurallara uygun" anlamı taşımaktadır; bunun karşıtı "yanlış"tır. A seçeneğindeki "eğri", "doğru"nun geometrik anlamının karşıtıdır ve bu cümleye uymaz; en güçlü çeldirici budur. B ve D seçenekleri ise davranış niteleyen bir karşıtlık kurmaz. Zıt anlamlıyı ararken önce sözcüğün cümlede hangi anlamda kullanıldığını belirlemelisin.',
              difficulty: 4,
              expectedSeconds: 70,
              tags: ['zıt anlamlılık', 'bağlam', 'çok anlamlılık'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.5',
            },
            {
              stem: `**I.** Kimi sözcüklerin yazılışı aynı olduğu hâlde anlamları arasında hiçbir bağ bulunmaz.
**II.** Kimi sözcükler ise aynı kavramı farklı seslerle karşılar.

Yukarıda sırasıyla hangi anlam ilişkileri açıklanmıştır?`,
              options: [
                { key: 'A', text: 'Sesteşlik – Eş anlamlılık' },
                { key: 'B', text: 'Eş anlamlılık – Sesteşlik' },
                { key: 'C', text: 'Çok anlamlılık – Yakın anlamlılık' },
                { key: 'D', text: 'Sesteşlik – Zıt anlamlılık' },
              ],
              correctOption: 'A',
              explanation:
                'I. açıklamada "yazılış aynı, anlamlar ilgisiz" denmesi sesteşliğin tanımıdır; "yaz" (mevsim) ile "yaz" (yazmak) buna örnektir. II. açıklamada "aynı kavram, farklı sesler" denmesi ise eş anlamlılığın tanımıdır; "okul – mektep" buna örnektir. B seçeneği doğru kavramları içerir ama sırayı ters verdiği için yanlıştır; "sırasıyla" ifadesi bulunan sorularda sıra kontrolü şarttır.',
              difficulty: 5,
              expectedSeconds: 85,
              tags: ['sesteşlik', 'eş anlamlılık', 'tanım'],
              source: 'original',
              outcomeCode: 'T.8.3.5.5',
            },
            {
              stem: 'Aşağıdaki cümlelerin hangisinde sözcükler arasında genel–özel anlam ilişkisi vardır?',
              options: [
                { key: 'A', text: 'Uzun yolu şaşırtıcı derecede kısa sürede aldık.' },
                { key: 'B', text: 'Bu okulun, bu mektebin havası bir başkadır.' },
                { key: 'C', text: 'Kalemi masaya, defteri çantaya koydu.' },
                { key: 'D', text: 'Bahçemizde çeşitli ağaçlar, özellikle de kiraz var.' },
              ],
              correctOption: 'D',
              explanation:
                'D seçeneğinde "ağaç" genel, "kiraz" ise onun kapsamına giren özel bir türdür; aradaki ilişki genel–özeldir. A seçeneğinde "uzun – kısa" zıt anlamlı, B seçeneğinde "okul – mektep" eş anlamlıdır. C seçeneğinde kalem, masa, defter ve çanta aynı ortamda geçen ama biri diğerini kapsamayan sözcüklerdir; yan yana gelmeleri anlam ilişkisi kurmaya yetmez.',
              difficulty: 5,
              expectedSeconds: 90,
              tags: ['genel-özel ilişkisi', 'eş anlamlılık', 'zıt anlamlılık'],
              source: 'exam_style',
              outcomeCode: 'T.8.3.5.6',
            },
          ],
          flashcards: [
            {
              front: 'Eş anlamlı sözcük nedir? Bir örnek ver.',
              back: 'Farklı seslerle aynı kavramı karşılayan sözcüklerdir. Örnek: okul – mektep.',
            },
            {
              front: 'Sesteş (eş sesli) sözcük nedir?',
              back: 'Yazılışı aynı, anlamları arasında hiçbir ilgi bulunmayan sözcüklerdir. Örnek: yaz (mevsim) – yaz (yazmak).',
            },
            {
              front: '"Gitmek" sözcüğünün zıt anlamlısı nedir?',
              back: '"Gelmek"tir. "Gitmemek" yalnızca fiilin olumsuzudur; olumsuzluk zıtlık değildir.',
            },
            {
              front: 'Sesteşlik ile çok anlamlılık nasıl ayırt edilir?',
              back: 'Anlamlar arasında akrabalık varsa çok anlamlılık (ağacın dalı / bilimin dalı), hiç yoksa sesteşliktir.',
            },
            {
              front: 'Genel–özel anlam ilişkisi nedir?',
              back: 'Bir sözcüğün diğerini anlamca kapsamasıdır: varlık > canlı > hayvan > kedi.',
            },
          ],
        },
      ],
    },
  ],
}
