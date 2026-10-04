/**
 * 外型規則：把「目、科」分類轉成一般人會用的白話描述
 *
 * - 依類群分開，每條規則的 match 是「目」、「亞目」或「科」的學名
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
  odonata: [
    { label: '豆娘（身體細長，停下來翅膀合起來）', match: ['Zygoptera'] },
    { label: '蜻蜓（停下來翅膀攤平）', match: ['Anisoptera', 'Odonata'] },
  ],
}
