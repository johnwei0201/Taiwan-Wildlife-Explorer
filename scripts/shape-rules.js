/**
 * 外型規則：把「目、科」分類轉成一般人會用的白話描述
 *
 * - 依類群分開，每條規則的 match 是「目」、「亞目」、「科」或「亞科」的學名
 *   （亞科用在同一科裡外型差很多的情況，例如裳蛾科裡的燈蛾、毒蛾）
 * - 由上往下比對，第一個符合的就採用，所以「科」的規則要放在「目」前面
 *   （例如鳥類的「雀形目」放最後，當作其他小型鳥的總稱）
 * - 都不符合的會歸為「其他」
 */
export const SHAPE_RULES = {
  aves: [
    { label: '鴨子、雁鵝', match: ['Anatidae'] },
    { label: '鷺鷥（腳長、脖子長）', match: ['Ardeidae'] },
    { label: '鶴、鸛、琵鷺等大型水鳥', match: ['Gruidae', 'Ciconiidae', 'Threskiornithidae', 'Pelecanidae', 'Phoenicopteridae'] },
    { label: '鷸、鴴（水邊的小型涉禽）', match: ['Scolopacidae', 'Charadriidae', 'Recurvirostridae', 'Haematopodidae', 'Jacanidae', 'Rostratulidae', 'Glareolidae'] },
    { label: '海鷗、燕鷗', match: ['Laridae', 'Stercorariidae'] },
    { label: '遠洋海鳥', match: ['Procellariidae', 'Diomedeidae', 'Hydrobatidae', 'Sulidae', 'Fregatidae', 'Phaethontidae', 'Alcidae', 'Gaviidae'] },
    { label: '鸕鷀、鸊鷉（會潛水）', match: ['Phalacrocoracidae', 'Podicipedidae'] },
    { label: '秧雞、紅冠水雞', match: ['Rallidae'] },
    { label: '老鷹、隼（猛禽）', match: ['Accipitridae', 'Pandionidae', 'Falconidae'] },
    { label: '貓頭鷹、夜鷹（夜間活動）', match: ['Strigidae', 'Tytonidae', 'Caprimulgidae'] },
    { label: '鴿子、斑鳩', match: ['Columbidae'] },
    { label: '雞、雉、鶉', match: ['Phasianidae', 'Turnicidae'] },
    { label: '啄木鳥、五色鳥', match: ['Picidae', 'Megalaimidae'] },
    { label: '翠鳥、蜂虎、戴勝（色彩鮮豔）', match: ['Alcedinidae', 'Meropidae', 'Coraciidae', 'Upupidae'] },
    { label: '燕子、雨燕', match: ['Hirundinidae', 'Apodidae'] },
    { label: '鸚鵡', match: ['Cacatuidae', 'Psittacidae', 'Psittaculidae'] },
    { label: '杜鵑', match: ['Cuculidae'] },
    { label: '烏鴉、喜鵲、藍鵲', match: ['Corvidae'] },
    { label: '伯勞（嘴巴像小老鷹）', match: ['Laniidae'] },
    { label: '鶺鴒、鷚（尾巴上下擺動）', match: ['Motacillidae'] },
    { label: '小型鳴禽（麻雀、白頭翁等）', match: ['Passeriformes'] },
  ],
  mammalia: [
    { label: '蝙蝠', match: ['Chiroptera'] },
    { label: '鯨、豚、海豹', match: ['Balaenopteridae', 'Delphinidae', 'Kogiidae', 'Phocoenidae', 'Physeteridae', 'Ziphiidae', 'Phocidae'] },
    { label: '鹿、羊、野豬', match: ['Cervidae', 'Bovidae', 'Suidae'] },
    { label: '猴子', match: ['Primates'] },
    { label: '熊', match: ['Ursidae'] },
    { label: '貓、鼬、白鼻心（食肉動物）', match: ['Felidae', 'Herpestidae', 'Mustelidae', 'Viverridae'] },
    { label: '松鼠、飛鼠', match: ['Sciuridae'] },
    { label: '老鼠', match: ['Muridae', 'Cricetidae'] },
    { label: '鼩鼱、鼴鼠（尖嘴小型）', match: ['Eulipotyphla'] },
    { label: '兔子', match: ['Lagomorpha'] },
    { label: '穿山甲', match: ['Pholidota'] },
  ],
  reptilia: [
    { label: '蛇', match: ['Colubridae', 'Elapidae', 'Homalopsidae', 'Pareidae', 'Psammodynastidae', 'Pythonidae', 'Typhlopidae', 'Viperidae', 'Xenodermidae'] },
    { label: '壁虎', match: ['Gekkonidae'] },
    { label: '海龜', match: ['Cheloniidae', 'Dermochelyidae'] },
    { label: '烏龜、鱉', match: ['Testudines'] },
    { label: '蜥蜴、攀蜥、石龍子', match: ['Squamata'] },
  ],
  amphibia: [
    { label: '蟾蜍（皮膚粗糙有疙瘩）', match: ['Bufonidae'] },
    { label: '樹蛙（腳趾有吸盤）', match: ['Rhacophoridae', 'Hylidae'] },
    { label: '青蛙', match: ['Anura'] },
    { label: '山椒魚（有尾巴）', match: ['Caudata'] },
  ],
  lepidoptera: [
    { label: '鳳蝶（體型大，很多有尾突）', match: ['Papilionidae'] },
    { label: '粉蝶（白色、黃色為主）', match: ['Pieridae'] },
    { label: '蛺蝶（停下來常張開翅膀）', match: ['Nymphalidae'] },
    { label: '灰蝶（小型，翅膀背面有細紋）', match: ['Lycaenidae', 'Riodinidae'] },
    { label: '弄蝶（身體粗壯，像小飛機）', match: ['Hesperiidae'] },
  ],
  moth: [
    { label: '天蠶蛾、枯葉蛾（大型、身體毛茸茸）', match: ['Saturniidae', 'Lasiocampidae', 'Bombycidae', 'Eupterotidae', 'Brahmaeidae', 'Endromidae'] },
    { label: '天蛾（身體粗壯、翅膀窄長，飛很快）', match: ['Sphingidae'] },
    { label: '燈蛾、毒蛾（色彩鮮豔或毛很多）', match: ['Arctiinae', 'Lymantriinae', 'Aganainae'] },
    { label: '斑蛾、燕蛾（白天活動，長得像蝴蝶）', match: ['Zygaenidae', 'Uraniidae', 'Epicopeiidae', 'Callidulidae'] },
    { label: '尺蛾（翅膀薄，停下來攤平）', match: ['Geometridae'] },
    { label: '螟蛾、草螟（小型，翅膀呈三角形）', match: ['Crambidae', 'Pyralidae'] },
    { label: '夜蛾、裳蛾（多為灰褐色）', match: ['Erebidae', 'Noctuidae', 'Nolidae', 'Euteliidae'] },
    { label: '刺蛾（小而厚實，幼蟲身上有毒刺）', match: ['Limacodidae'] },
    { label: '鉤蛾（翅膀尖端彎成鉤狀）', match: ['Drepanidae'] },
    { label: '舟蛾（停下來像一截樹枝）', match: ['Notodontidae'] },
    { label: '其他蛾類', match: ['Lepidoptera'] },
  ],
  coleoptera: [
    { label: '鍬形蟲（大顎像夾子）', match: ['Lucanidae'] },
    { label: '獨角仙、金龜子', match: ['Scarabaeidae'] },
    { label: '天牛（觸角很長）', match: ['Cerambycidae'] },
    { label: '瓢蟲（圓圓的，常有斑點）', match: ['Coccinellidae'] },
    { label: '象鼻蟲（嘴巴長長的）', match: ['Curculionidae', 'Brentidae', 'Attelabidae', 'Anthribidae', 'Dryophthoridae'] },
    { label: '螢火蟲、紅螢（身體軟）', match: ['Lampyridae', 'Lycidae', 'Cantharidae'] },
    { label: '吉丁蟲、叩頭蟲（身體長橢圓）', match: ['Buprestidae', 'Elateridae'] },
    { label: '金花蟲（小型、常有金屬光澤）', match: ['Chrysomelidae'] },
    { label: '步行蟲、虎甲蟲（腳長、跑很快）', match: ['Carabidae', 'Cicindelidae'] },
    { label: '擬步行蟲（黑色、常在朽木上）', match: ['Tenebrionidae'] },
    { label: '龍蝨、牙蟲（在水裡生活）', match: ['Dytiscidae', 'Hydrophilidae', 'Gyrinidae'] },
    { label: '隱翅蟲（翅鞘很短，露出肚子）', match: ['Staphylinidae'] },
    { label: '其他甲蟲', match: ['Coleoptera'] },
  ],
  mantodea: [
    { label: '螳螂', match: ['Mantodea'] },
  ],
  phasmida: [
    { label: '葉䗛（扁平，像一片葉子）', match: ['Phylliidae'] },
    { label: '竹節蟲（細長，像一根樹枝）', match: ['Phasmida'] },
  ],
  odonata: [
    { label: '豆娘（身體細長，停下來翅膀合起來）', match: ['Zygoptera'] },
    { label: '蜻蜓（停下來翅膀攤平）', match: ['Anisoptera', 'Odonata'] },
  ],
}
