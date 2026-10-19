'use strict';
/* Syllabus data for Husayn Bijak.
   MEMBACA follows "Siri Cepat Membaca: Bacalah Anakku" (Nik Eliani Nik Nawi & Othman Ahamad), Buku 1 to 8.
   Letter order, words and sentences are taken from the books; Buku 7 and 8 sentences marked (*) are our own,
   built only from that book's words. */

/* picture for every word that can be drawn */
const PIC={
 api:'🔥',ubi:'🍠',itik:'🦆',ikan:'🐟',ibu:'👩',ulat:'🐛',ubat:'💊',ular:'🐍',nanas:'🍍',nuri:'🦜',nipah:'🌴',baju:'👕',biji:'🌰',bunga:'🌸',
 mulut:'👄',mata:'👁️',minum:'🥤',sikat:'🪮',sayur:'🥬',susu:'🥛',kuku:'💅',kipas:'🪭',katak:'🐸',nasi:'🍚',kaki:'🦶',siku:'💪',
 tikus:'🐭',timun:'🥒',yu:'🦈',yoyo:'🪀',cicak:'🦎',cawan:'☕',cili:'🌶️',pisang:'🍌',payung:'☂️',pintu:'🚪',
 buku:'📖',bayi:'👶','kupu-kupu':'🦋',paku:'🔩',muka:'😊',kayu:'🪵',papa:'👨',bapa:'👨',
 dadu:'🎲',kuda:'🐴',sudu:'🥄',padi:'🌾',gigi:'🦷',naga:'🐉',tiga:'3️⃣',lima:'🖐️',batu:'🪨',tali:'🪢',guli:'🔮',gula:'🍬',
 'rama-rama':'🦋','biri-biri':'🐑',guru:'🧑‍🏫',lari:'🏃',pipi:'😊',madu:'🍯',dagu:'🧔',
 hati:'❤️',hidu:'👃',raja:'🤴',satu:'1️⃣',sawi:'🥬',haji:'👳',jari:'☝️',
 bulan:'🌙',lilin:'🕯️',sabun:'🧼',hutan:'🌳',makan:'🍽️',jalan:'🛣️',mandi:'🛁',badak:'🦏',gagak:'🐦‍⬛',anak:'🧒',kakak:'👧',adik:'👶',masak:'🍳',
 jambu:'🍐',jarum:'🪡',malam:'🌃',mimpi:'💭',pasir:'🏖️',tayar:'🛞',mawar:'🌹',tidur:'😴',dapur:'🍳',bilik:'🛏️',datuk:'👴',taman:'🏞️',
 bola:'⚽',topi:'🧢',roti:'🍞',kopi:'☕',lori:'🚚',pokok:'🌳',lobak:'🥕',bomba:'🚒',otak:'🧠',kolam:'🏊',ketam:'🦀',cermin:'🪞',
 meja:'🪑',feri:'⛴️',nenek:'👵',oren:'🍊',ekor:'🐒',emas:'🥇',kertas:'📄',polis:'👮',epal:'🍎',katil:'🛏️',bakul:'🧺',pensel:'✏️',botol:'🍼',semut:'🐜',
 udang:'🦐',kambing:'🐐',burung:'🐦',singa:'🦁',telinga:'👂',nyamuk:'🦟',minyak:'🛢️',kuali:'🍳',radio:'📻',biola:'🎻',piano:'🎹',kedai:'🏪',limau:'🍋',air:'💧',wau:'🪁',duit:'💵',orang:'🧍',topeng:'🎭',goreng:'🍳'
};

/* units: a new letter (Buku 1-5) or a new pattern (Buku 6-8). pics = picture words used on the letter page */
const BA=[null,
 {n:1,col:'#F28C28',name:'Buku 1',focus:'a i u · n b',
  units:[{u:'a',sy:['a'],pics:['api']},{u:'i',sy:['i'],pics:['itik','ikan','ibu']},{u:'u',sy:['u'],pics:['ulat','ubat','ular']},
         {u:'n',sy:['na','ni','nu'],pics:['nanas','nuri','nipah']},{u:'b',sy:['ba','bi','bu'],pics:['baju','biji','bunga']}],
  words:['ana','ani','ina','ini','abu','ibu','ubi'],
  sent:['ini ani.','ini ibu ani.','ini abu.','ini ibu abu.','ini ubi. (*)','ini ina. (*)','ini ubi ani. (*)','ini ana. (*)','ini ubi abu. (*)']},
 {n:2,col:'#D93B3B',name:'Buku 2',focus:'m s k',
  units:[{u:'m',sy:['ma','mi','mu'],pics:['mulut','mata','minum']},{u:'s',sy:['sa','si','su'],pics:['sikat','sayur','susu']},{u:'k',sy:['ka','ki','ku'],pics:['kuku','kipas','katak']}],
  words:['mana','susu','sani','nasi','basi','nani','kuku','kaki','siku','suka'],
  sent:['mana ani?','mana ibu ani? ini ibu ani.','mana ana, ibu? ini ana, ani.','mana nasi sani? ini nasi sani.','ibu, nasi sani basi.','ibu, susu sani basi.','nani suka nasi.','ini kuku kaki sani.','mana siku sani? ini siku sani.','ani suka nasi?']},
 {n:3,col:'#2F6FD0',name:'Buku 3',focus:'t y c p',
  units:[{u:'t',sy:['ta','ti','tu'],pics:['tikus','timun','tali']},{u:'y',sy:['ya','yi','yu'],pics:['yu','yoyo','payung']},{u:'c',sy:['ca','ci','cu'],pics:['cicak','cawan','cili']},{u:'p',sy:['pa','pi','pu'],pics:['pisang','payung','pintu']}],
  words:['itu','buku','mata','saya','bayi','baca','cuci','papa','kupu-kupu','paku','apa','kata','ciku','kaca','muka','cucu','sana','sini','titi','kayu','suci'],
  sent:['itu buku.','mana mata? itu mata.','mana buku mimi? ini buku mimi.','itu kutu, kata abu.','saya nani. saya suka buku.','itu bayi. saya suka bayi.','nani suka baca buku.','sani suka cuci kuku.','apa itu, papa? itu kupu-kupu.','itu paku, kata bapa. bapa paku kayu.']},
 {n:4,col:'#2E9A55',name:'Buku 4',focus:'d g l r',
  units:[{u:'d',sy:['da','di','du'],pics:['dadu','kuda','sudu']},{u:'g',sy:['ga','gi','gu'],pics:['gigi','naga','tiga']},{u:'l',sy:['la','li','lu'],pics:['lima','batu','tali']},{u:'r',sy:['ra','ri','ru'],pics:['rama-rama','biri-biri','guru']}],
  words:['ada','dadu','dada','kuda','padi','sudu','tadi','muda','pada','pipi','cuti','sagu','tiga','pagi','gigi','naga','guna','dagu','bagi','madu','gula','guli','batu','malu','lima','lagi','lupa','lama','tali','luka','baru','lari','guru','rasa','rama-rama','biri-biri'],
  sent:['itu apa, bapa? itu kuda.','saya ada dadu.','pagi ini nani baca apa?','buku naga, ibu.','naga itu ada tiga kaki.','di mana guli ali? itu guli ali.','ibu, lili suka gula-gula.','lila ada sari. sari lila biru.','sami ada rama-rama.','rama-rama sami lari.']},
 {n:5,col:'#7B4FB5',name:'Buku 5',focus:'h j w f z',
  units:[{u:'h',sy:['ha','hi','hu'],pics:['hati','hidu','haji']},{u:'j',sy:['ja','ji','ju'],pics:['baju','raja','jari']},{u:'w',sy:['wa','wi','wu'],pics:['sawi']},{u:'f',sy:['fa','fi','fu'],pics:[]},{u:'z',sy:['za','zi','zu'],pics:[]}],
  words:['hari','raya','rabu','hati','dahi','mahu','tahu','hidu','kari','dari','biru','haji','jadi','jamu','jaga','baju','satu','biji','maju','juga','raja','bawa','sawi','jawi','lawa','jiwa'],
  sent:['ibu, hari ini hari apa?','hari ini hari rabu.','hari raya tiga hari lagi.','ali ada baju baru?','baju baru ali biru.','ibu juga suka hati.','bapa hawa bawa buku.','buku apa? buku jawi.']},
 {n:6,col:'#E5609B',name:'Buku 6',focus:'-n -k -m -r',closed:true,
  units:[{u:'-n',sy:['dan','lan','kan','pan','tun'],pics:['bulan','ikan','lilin']},{u:'-k',sy:['mak','nak','dak','dik','duk'],pics:['badak','cicak','anak']},{u:'-m',sy:['sam','lam','num','rum'],pics:['jambu','jarum','minum']},{u:'-r',sy:['bar','kar','sir','yur','dur'],pics:['pasir','tayar','mawar']}],
  words:['badan','bulan','ikan','hutan','papan','taman','makan','cawan','jalan','lilin','rajin','licin','sabun','turun','tahun','timun','nanti','mandi','bantu','pintu','minta','anak','kakak','badak','masak','cicak','gagak','adik','bilik','datuk','masuk','balik','duduk','sibuk','masam','jambu','musim','jarum','malam','mimpi','minum','jumpa','sabar','tikar','pasir','fikir','sayur','dapur','tayar','pasar','mawar','tidur'],
  sent:['Ali suka makan ikan.','Ali makan ikan di taman.','Ini Amin. Itu Budin.','Amin dan Budin kawan.','Razak ada kakak.','Kakak Razak suka masak.','Malam tadi Ali mimpi.','Bapa suka tanam sayur.','Sayur bapa subur.']},
 {n:7,col:'#9B2F45',name:'Buku 7',focus:'o · e · -s -l -h -t',closed:true,
  units:[{u:'o',sy:['bo','to','ro','ko','lo'],pics:['bola','topi','roti']},{u:'e',sy:['be','ke','pe','se','te'],pics:['ketam','cermin']},{u:'é',sy:['me','fe','ne','re'],pics:['meja','feri','nenek']},{u:'-s -l',sy:['mas','las','pal','sil','tol'],pics:['emas','epal','pensel']},{u:'-h -t',sy:['bah','dah','sih','bat','mut'],pics:['semut','ubat','ulat']}],
  words:['bola','topi','roti','kota','lori','kopi','tolak','kolam','pokok','lobak','bomba','otak','beli','debu','geli','peti','ketam','kebun','sejuk','cermin','meja','feri','beca','ekor','esok','nenek','oren','emas','kelas','kertas','polis','epal','kecil','katil','bakul','pensel','botol','abah','sudah','tambah','bersih','ubat','ulat','sakit','takut','semut'],
  sent:['Ini bola Amin. (*)','Nenek beli roti di kedai kopi. (*)','Ada ketam di kolam. (*)','Pensel adik di atas meja. (*)','Abah naik feri. (*)','Semut kecil suka gula. (*)']},
 {n:8,col:'#E9B824',name:'Buku 8',focus:'ng ny sy kh · ai au',closed:true,
  units:[{u:'ng',sy:['nga','ngi','ngu','ang','ung'],pics:['pisang','singa','burung']},{u:'ny',sy:['nya','nyi','nyu'],pics:['nyamuk','minyak']},{u:'sy kh',sy:['sya','syi','kha','khu'],pics:[]},{u:'ai au',sy:['dai','rai','mau','jau','wau'],pics:['kedai','limau','wau']}],
  words:['orang','udang','pisang','kambing','burung','goreng','topeng','tolong','kosong','bunga','singa','telinga','wangi','ungu','tanya','punya','nyamuk','banyak','minyak','bunyi','sunyi','kunyit','khabar','siapa','piano','radio','biola','kuali','duit','kuih','air','kedai','gerai','wau','hijau','limau'],
  sent:['Siapa punya burung? (*)','Singa itu ada telinga. (*)','Ibu goreng udang di dapur. (*)','Banyak nyamuk di hutan. (*)','Abah beli limau di kedai. (*)','Adik main wau. (*)']}
];

/* Malay syllabifier: digraphs ng ny sy kh gh are one consonant; ai au oi at the end of a word are one vowel. */
function sukuKata(w){
  if(w.includes('-'))return w.split('-').flatMap(p=>sukuKata(p));
  const V='aeiouéè';const t=[];let i=0;const s=w.toLowerCase();
  while(i<s.length){const two=s.slice(i,i+2);
    if(['ng','ny','sy','kh','gh'].includes(two)){t.push({c:two});i+=2;continue;}
    if(V.includes(s[i])){t.push({v:s[i]});i++;continue;}
    t.push({c:s[i]});i++;}
  /* end diphthong */
  const L=t.length;
  if(L>=2&&t[L-1].v&&t[L-2].v&&['ai','au','oi'].includes(t[L-2].v+t[L-1].v)){t.splice(L-2,2,{v:t[L-2].v+t[L-1].v});}
  const vi=t.map((x,k)=>x.v?k:-1).filter(k=>k>=0);if(vi.length<=1)return [w];
  const cuts=[];
  for(let k=0;k<vi.length-1;k++){const a=vi[k],b=vi[k+1],n=b-a-1;cuts.push(n<=1?a+1:a+2);}
  const out=[];let st=0;const str=x=>x.c||x.v;
  for(const c of cuts){out.push(t.slice(st,c).map(str).join(''));st=c;}
  out.push(t.slice(st).map(str).join(''));return out;
}

/* ---------- IQRA' (KH As'ad Humam), Jilid 1 to 6, in page order ----------
   Each page: t = the boxed heading (the only part the teacher models), ex = rows from the book,
   gen = rule for extra drill rows. Words in Jilid 2+ are the book's own reading drills. */
const IQ1_ORDER=['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','و','ه','ي'];
const IQ_PAIRS=[['ا','ع'],['ث','س'],['ح','ه'],['ث','ش'],['ج','ز'],['س','ش'],['ذ','ز'],['س','ص'],['خ','غ'],['ت','ط'],['خ','ق'],['ذ','ظ'],['ك','ق'],['ظ','ض']];
const IQ=[null,
 {n:1,col:'#2F8F5B',name:"Iqra' 1",focus:'Huruf tunggal, baris atas',pages:[
   ...IQ1_ORDER.slice(1).map((c,i)=>({t:i===0?'أَ بَ':c+'َ',gen:{upto:i+1,v:'a',mode:'single'}})),
   {t:'أَ = ءَ',gen:{upto:27,v:'a',mode:'single',hamzah:true}},
   {t:'Ulang kaji',gen:{upto:27,v:'a',mode:'single',review:true}},
   {t:'Beza dengan jelas',gen:{mode:'pairs'}},
   {t:'Ujian',gen:{upto:27,v:'a',mode:'single',test:true}}]},
 {n:2,col:'#2A9DA8',name:"Iqra' 2",focus:'Huruf bersambung, panjang',pages:[
   {t:'بَتَ',ex:['بَتَ','بَدَ','تَرَ','تَوَ','تَتَ','تَدَ','بَرَ','بَوَ'],gen:{letters:'بتدرو',len:[2,3]}},
   {t:'نَبَ',ex:['نَبَ','نَنَ','نَتَنَ','نَبَبَ','بَنَنَ','نَبَتَ','بَنَتَ','تَبَنَ','نَتَبَ'],gen:{letters:'بتنرد',len:[2,3]}},
   {t:'يَتَ',ex:['يَتَ','رَبَيَ','يَبَرَ','رَنَيَ','يَنَرَ','بَيَنَ','نَبَيَ','يَدَنَ','دَنَيَ'],gen:{letters:'يبتنرد',len:[2,3]}},
   {t:'جَ حَ خَ',ex:['جَرَ','حَجَرَ','بَجَ','جَبَ','خَدَ','نَدَ','ثَجَ','هَوَ','خَزَ'],gen:{letters:'جحخبتنر',len:[2,3]}},
   {t:'سَ شَ صَ ضَ',ex:['سَدَ','شَرَ','صَدَ','ضَرَ','سَنَ','بَسَ','شَتَ','يَسَ'],gen:{letters:'سشصضبتنرد',len:[2,3]}},
   {t:'عَ',ex:['عَدَ','بَعَ','بَعَدَ','رَعَتَ','تَعَرَ','عَتَرَ','رَتَعَ'],gen:{letters:'عبتردن',len:[2,3]}},
   {t:'طَ ظَ غَ',ex:['خَطَبَ','هَدَمَ','عَظَمَ','صَرَفَ','وَجَدَ','شَغَلَ','غَسَقَ','ضَحَكَ'],gen:{letters:'طظغعبرد',len:[3,3]}},
   {t:'فَ قَ',ex:['نَفَقَ','قَفَلَ','فَرَغَ','نَفَلَ','قَبَحَ','وَقَعَ'],gen:{letters:'فقبتنرل',len:[3,3]}},
   {t:'Campuran',ex:['سَأَلَ','نَصَحَ','بَيَعَ','يَقَنَ','خَرَجَ','ذَهَبَ','جَعَلَ'],gen:{letters:'بتجحخدرسعفقلمن',len:[3,3]}},
   {t:'كَ',ex:['كَتَبَ','سَكَتَ','كَذَبَ','أَكَلَ','حَكَمَ','تَرَكَ'],gen:{letters:'كتبسذحمر',len:[3,3]}},
   {t:'لَ لَا',ex:['لَبَدَ','لَا','لَكَ','لَنَ'],gen:{letters:'لبدكسن',len:[2,3]}},
   {t:'مَ',ex:['جَمَعَ','عَمَدَ','صَمَدَ','ظَلَمَ','هَمَزَ','غَنَمَ'],gen:{letters:'مجعدصلن',len:[3,3]}},
   {t:'هَ',ex:['نَهَرَ','شَهَدَ','هَلَكَ','رَهَقَ','كَهَنَ'],gen:{letters:'هنرشدلك',len:[3,3]}},
   {t:'بَا (panjang)',ex:['بَا','مَا','هَا','ذَا','لَا','كَا','نَا','رَا','بَاتَ','تَابَ','يَانَ'],mad:true},
   {t:'Panjang · pendek',ex:['ثَابَتَ','ثَبَاتَ','ثَبَاتَا','زَابَدَ','زَبَادَ','تَاوَبَ','تَوَابَ'],mad:true},
   {t:'Panjang dalam kata',ex:['أَصَابَ','أَعَادَ','أَقَامَ','طَمَعَ','قَاتَلَ','وَاعَدَ','جَامَعَ'],mad:true},
   {t:'بٰ = بَا',ex:['بٰ','أٰدَمَ','أٰمَنَ','وَهٰذَا'],mad:true},
   {t:'ى tidak dibaca',ex:['سَجٰى','وَأَتٰى','فَأَوٰى','يَتَامٰى','فَهَدٰى','فَقَضٰى'],mad:true},
   {t:'Ujian',ex:['ثَابَتَ','أَذَانَ','صَافَحَا','خَطَايَا'],mad:true}]},
 {n:3,col:'#6B4E9B',name:"Iqra' 3",focus:'Baris bawah, depan, panjang',pages:[
   {t:'بِ (baris bawah)',ex:['تَ تِ','دَ دِ','نَ نِ','مَ مِ'],gen:{letters:'بتدنمرسك',len:[1,1],v:'ai'}},
   {t:'Baris bawah dalam kata',ex:['شَهِدَ','لَعِبَ','رَضِيَ','غَنِمَ'],gen:{letters:'بتدنمرسكلعه',len:[2,3],v:'ai'}},
   {t:'بِيْ (panjang)',ex:['جِيْ','نِيْ','لِيْ','فِيْ'],mad:true},
   {t:'Panjang · pendek',ex:['فَعَلَ','فَاعِلِ','كَتَبَ','كَاتِبِ','جَلَسَ','جَالِسِ'],mad:true},
   {t:'بُ (baris depan)',ex:['بَ بِ بُ','تَ تِ تُ','جَ جِ جُ','دَ دِ دُ'],gen:{letters:'بتجدرسكلمن',len:[1,1],v:'aiu'}},
   {t:'Baris depan dalam kata',ex:['خَلَقُ','قَبَضُ','كُتُبُ','رُسُلُ'],gen:{letters:'بتجدرسكلمنق',len:[2,3],v:'aiu'}},
   {t:'بُوْ (panjang)',ex:['تَابَ','يَتُوْبُ','قَالَ','يَقُوْلُ','عَادَ','يَعُوْدُ','كَانَ','يَكُوْنُ'],mad:true},
   {t:'قَالُوْا',ex:['قَالُوْا','أٰمَنُوْا','وَعَمِلُوْا'],mad:true},
   {t:'Ujian',ex:['خَاشِعِيْنَ','ظَالِمِيْنَ','يَخَافُوْنَ','حَدِيْثُ'],mad:true}]},
 {n:4,col:'#E8573F',name:"Iqra' 4",focus:'Tanwin, ai/au, sukun',needRec:true,pages:[
   {t:'بًا (pendek)',ex:['بًا','تًا','ثًا','جًا','وَهُدًى','قَعَدًا','جَمِيْعًا']},
   {t:'بٍ',ex:['تٍ','دٍ','مٍ','وٍ','عَمَدٍ','قَفَصٍ']},
   {t:'بٌ',ex:['بَ بِ بُ','بًا بٍ بٌ','سًا سٍ سٌ']},
   {t:'بَيْ (ai)',ex:['بَيْنَ','بِيْنَ','دِيْنِ','دَيْنِ','كَيْفَ','حَيْثُ']},
   {t:'بَوْ (au)',ex:['بَوْ','بُوْ','تُوْبَ','تَوْبَ','سُوْفَ','سَوْفَ','لَوْحَ']},
   {t:'مْ',ex:['أَمْ','إِمْ','أُمْ','لَمْ','كَمْ','هُمْ','لَكُمْ']},
   {t:'نْ',ex:['أَنْ','إِنْ','عَنْ','مَنْ','مِنْ']},
   {t:'Qalqalah',ex:['أَبْ','أَجْ','أَدْ','أَطْ','أَقْ','تُبْدُوْا']},
   {t:'Sukun lain',ex:['غَلَبَتْ','مِثْقَالَ','يُحْسِنُوْنَ','أَشْتَاتًا']},
   {t:'أْ عْ كْ قْ',ex:['تَأْ','تَعْ','تَكْ','تَقْ','تَأْكُلُ','أَعْمٰى','أَكْرَمُ']}]},
 {n:5,col:'#F6A93B',name:"Iqra' 5",focus:'Alif lam, waqaf, tasydid',needRec:true,pages:[
   {t:'اَلْ (qamariah)',ex:['اَلْحَمْدُ','وَالْحَمْدُ','وَالْعَصْرِ','وَالْفَجْرِ']},
   {t:'Waqaf',ex:['أَمِيْنْ','نَسْتَعِيْنُ','أَبَدَا','أٰنِيَهْ']},
   {t:'نّ مّ',ex:['اَنْ','اَنَّ','عَمْ','عَمَّ']},
   {t:'اَلْ (syamsiah)',ex:['وَالنَّهَارِ','وَالنَّاسِ','النَّارِ']},
   {t:'Tasydid',ex:['كَبَّرَ','يُكَبِّرُ','رَتَّلَ','عَلَّمَ','يُعَلِّمُ']},
   {t:'اللّٰه',ex:['وَاللّٰهُ','رَسُوْلُ اللّٰهِ','بِسْمِ اللّٰهِ','لِلّٰهِ']},
   {t:'Ujian',ex:['لَا إِلٰهَ إِلَّا اللّٰهُ','مُحَمَّدٌ رَّسُوْلُ اللّٰهِ']}]},
 {n:6,col:'#1E3A33',name:"Iqra' 6",focus:'Dengung, iqlab, ikhfa',needRec:true,pages:[
   {t:'نْ + و',ex:['مِنْ وَّاحِدٍ','عَنْ وَّالِدٍ']},
   {t:'نْ + ي',ex:['أَنْ يُّوْصَلَ','مَنْ يُّؤْمِنْ']},
   {t:'Iqlab',ex:['مِنْ بَعْدِ','كَافِرٌ بِهِ']},
   {t:'Ikhfa',ex:['أَنْتَ','مَنْ تَطَوَّعَ','مِنْ جُوْعٍ','فَمَنْ كَانَ']},
   {t:'Waqaf',ex:['لَهُنَّ','وَالْفَتْحْ','بِالْحَقِّ']},
   {t:'Fawatih',ex:['الٓمٓ','طٰهٰ','يٰسٓ','حٰمٓ','نٓ']}]}
];

/* parse a voweled Arabic word into syllables: {c, v:'a'|'i'|'u'|null, long, sukun, shadda, tanwin} */
const AR={F:'َ',K:'ِ',D:'ُ',S:'ْ',SH:'ّ',FT:'ً',KT:'ٍ',DT:'ٌ',DAG:'ٰ',MAD:'ٓ'};
function arParse(word){
  const out=[];const ch=[...word.replace(/[إأآ]/g,m=>m==='إ'?'ا':m==='آ'?'ا':'ا')];
  for(let i=0;i<ch.length;i++){
    const c=ch[i];if(c===' '){out.push({sp:true});continue;}
    if(/[ً-ٰٓ]/.test(c))continue;
    const marks=[];let j=i+1;while(j<ch.length&&/[ً-ٰٓ]/.test(ch[j])){marks.push(ch[j]);j++;}
    const s={c,v:null,long:false,sukun:marks.includes(AR.S),shadda:marks.includes(AR.SH),tanwin:null,dagger:marks.includes(AR.DAG)};
    if(marks.includes(AR.F))s.v='a';else if(marks.includes(AR.K))s.v='i';else if(marks.includes(AR.D))s.v='u';
    if(marks.includes(AR.FT)){s.v='a';s.tanwin='an';}if(marks.includes(AR.KT)){s.v='i';s.tanwin='in';}if(marks.includes(AR.DT)){s.v='u';s.tanwin='un';}
    if(s.dagger&&!s.v)s.v='a',s.long=true;
    out.push(s);i=j-1;
  }
  /* bare alif / ya / waw after a matching vowel lengthen it; bare ى is silent */
  const res=[];
  for(const s of out){const p=res[res.length-1];
    if(p&&!p.sp&&!s.sp&&!s.v&&!s.shadda){
      if(s.c==='ا'&&p.v==='a'&&!p.tanwin){p.long=true;continue;}
      if(s.c==='ى'){if(p.v)p.long=true;continue;}
      if(s.c==='ي'&&p.v==='i'){p.long=true;continue;}
      if(s.c==='و'&&p.v==='u'){p.long=true;continue;}
      if(s.c==='ا'&&p.tanwin)continue;
      if(s.c==='ي'&&s.sukun&&p.v==='a'){p.diph='ai';continue;}
      if(s.c==='و'&&s.sukun&&p.v==='a'){p.diph='au';continue;}
    }
    if(s.dagger&&p&&p.v==='a'&&!s.v){p.long=true;continue;}
    res.push(s);
  }
  return res;
}

/* WORD BANK beyond the books: same method (letters learned so far), many more examples.
   word: [picture, category]. The stage (which book's letters it needs) is worked out by wStage().
   A word is only used once its audio exists. */
const WB={
 'mi':['🍜','makanan'],
 'ubi':['🍠','makanan'],
 'bumi':['🌍',''],
 'kami':['',''],
 'kamu':['',''],
 'masa':['',''],
 'sama':['',''],
 'nasi':['🍚','makanan'],
 'mana':['',''],
 'batu':['🪨','benda'],
 'baju':['👕','benda'],
 'buku':['📖','benda'],
 'kuda':['🐴','haiwan'],
 'rusa':['🦌','haiwan'],
 'kura-kura':['🐢','haiwan'],
 'labi-labi':['','haiwan'],
 'buaya':['🐊','haiwan'],
 'paku':['🔩','benda'],
 'sapu':['🧹','benda'],
 'tali':['🪢','benda'],
 'gula':['🍬','makanan'],
 'madu':['🍯','makanan'],
 'lada':['🫑','benda'],
 'cili':['🌶️','makanan'],
 'ciku':['','makanan'],
 'sudu':['🥄','benda'],
 'padi':['🌾','makanan'],
 'pipi':['😊','badan'],
 'dagu':['🧔','badan'],
 'dahi':['','badan'],
 'bahu':['','badan'],
 'jari':['☝️','badan'],
 'gigi':['🦷','badan'],
 'kaki':['🦶','badan'],
 'mata':['👁️','badan'],
 'muka':['😊','badan'],
 'siku':['💪','badan'],
 'kuku':['💅','badan'],
 'lutut':['🦵','badan'],
 'tuala':['','benda'],
 'piza':['🍕','makanan'],
 'sari':['',''],
 'raja':['🤴','orang'],
 'guru':['🧑‍🏫','orang'],
 'bayi':['👶','orang'],
 'papa':['👨','orang'],
 'bapa':['👨','orang'],
 'mama':['👩','orang'],
 'datuk':['👴','orang'],
 'nenek':['👵','orang'],
 'tiga':['3️⃣',''],
 'lima':['🖐️',''],
 'satu':['1️⃣',''],
 'dua':['2️⃣',''],
 'sagu':['','makanan'],
 'susu':['🥛','minuman'],
 'dadu':['🎲','benda'],
 'lari':['🏃',''],
 'baca':['',''],
 'cuci':['',''],
 'tiup':['',''],
 'kayu':['🪵','benda'],
 'laju':['',''],
 'biru':['🔵',''],
 'hijau':['🟢',''],
 'batik':['',''],
 'pasu':['🏺','benda'],
 'api':['🔥','alam'],
 'matahari':['☀️','alam'],
 'pagi':['🌅',''],
 'hari':['',''],
 'jalan':['🛣️',''],
 'kupu-kupu':['🦋','haiwan'],
 'rama-rama':['🦋','haiwan'],
 'biri-biri':['🐑','haiwan'],
 'gula-gula':['🍬','makanan'],
 'bola':['⚽','benda'],
 'lori':['🚚','benda'],
 'roti':['🍞','makanan'],
 'topi':['🧢','benda'],
 'kopi':['☕','minuman'],
 'sate':['🍢','makanan'],
 'kek':['🎂','makanan'],
 'keju':['🧀','makanan'],
 'telur':['🥚','makanan'],
 'epal':['🍎','makanan'],
 'oren':['🍊','makanan'],
 'nanas':['🍍','makanan'],
 'betik':['','makanan'],
 'kelapa':['🥥','makanan'],
 'lobak':['🥕','makanan'],
 'kubis':['🥬','makanan'],
 'timun':['🥒','makanan'],
 'durian':['','makanan'],
 'jambu':['🍐','makanan'],
 'pisang':['🍌','makanan'],
 'tembikai':['🍉','makanan'],
 'anggur':['🍇','makanan'],
 'limau':['🍋','makanan'],
 'jagung':['🌽','makanan'],
 'biskut':['🍪','makanan'],
 'gajah':['🐘','haiwan'],
 'harimau':['🐅','haiwan'],
 'singa':['🦁','haiwan'],
 'kucing':['🐱','haiwan'],
 'ayam':['🐔','haiwan'],
 'itik':['🦆','haiwan'],
 'angsa':['🦢','haiwan'],
 'burung':['🐦','haiwan'],
 'helang':['🦅','haiwan'],
 'merak':['🦚','haiwan'],
 'ikan':['🐟','haiwan'],
 'ular':['🐍','haiwan'],
 'katak':['🐸','haiwan'],
 'lebah':['🐝','haiwan'],
 'semut':['🐜','haiwan'],
 'siput':['🐌','haiwan'],
 'ketam':['🦀','haiwan'],
 'udang':['🦐','haiwan'],
 'sotong':['🦑','haiwan'],
 'ulat':['🐛','haiwan'],
 'lembu':['🐄','haiwan'],
 'kerbau':['🐃','haiwan'],
 'kambing':['🐐','haiwan'],
 'arnab':['🐰','haiwan'],
 'tikus':['🐭','haiwan'],
 'monyet':['🐒','haiwan'],
 'beruang':['🐻','haiwan'],
 'zirafah':['🦒','haiwan'],
 'unta':['🐫','haiwan'],
 'paus':['🐋','haiwan'],
 'penyu':['🐢','haiwan'],
 'tupai':['🐿️','haiwan'],
 'lipas':['🪳','haiwan'],
 'labah-labah':['🕷️','haiwan'],
 'nyamuk':['🦟','haiwan'],
 'kasut':['👟','benda'],
 'stokin':['🧦','benda'],
 'beg':['🎒','benda'],
 'pensel':['✏️','benda'],
 'kertas':['📄','benda'],
 'gunting':['✂️','benda'],
 'kerusi':['🪑','benda'],
 'meja':['🪑','benda'],
 'pintu':['🚪','benda'],
 'tingkap':['🪟','benda'],
 'lampu':['💡','benda'],
 'jam':['⌚','benda'],
 'kereta':['🚗','benda'],
 'bas':['🚌','benda'],
 'basikal':['🚲','benda'],
 'kapal':['🚢','benda'],
 'bot':['⛵','benda'],
 'rumah':['🏠','benda'],
 'payung':['☂️','benda'],
 'kunci':['🔑','benda'],
 'pisau':['🔪','benda'],
 'garpu':['🍴','benda'],
 'cawan':['☕','benda'],
 'pinggan':['🍽️','benda'],
 'bantal':['','benda'],
 'katil':['🛏️','benda'],
 'selimut':['','benda'],
 'sikat':['🪮','benda'],
 'sabun':['🧼','benda'],
 'cermin':['🪞','benda'],
 'radio':['📻','benda'],
 'telefon':['📱','benda'],
 'gitar':['🎸','benda'],
 'loceng':['🔔','benda'],
 'wau':['🪁','benda'],
 'belon':['🎈','benda'],
 'hadiah':['🎁','benda'],
 'surat':['✉️','benda'],
 'kotak':['📦','benda'],
 'awan':['☁️','alam'],
 'bulan':['🌙','alam'],
 'bintang':['⭐','alam'],
 'hujan':['🌧️','alam'],
 'pelangi':['🌈','alam'],
 'laut':['🌊','alam'],
 'pasir':['🏖️','alam'],
 'pokok':['🌳','alam'],
 'daun':['🍃','alam'],
 'bunga':['🌸','alam'],
 'gunung':['⛰️','alam'],
 'sungai':['','alam'],
 'rumput':['🌱','alam'],
 'salji':['❄️','alam'],
 'abang':['','orang'],
 'kakak':['👧','orang'],
 'adik':['👶','orang'],
 'doktor':['🧑‍⚕️','orang'],
 'polis':['👮','orang'],
 'bomba':['🚒','orang'],
 'puteri':['👸','orang'],
 'petani':['🧑‍🌾','orang'],
 'tangan':['✋','badan'],
 'hidung':['👃','badan'],
 'telinga':['👂','badan'],
 'lidah':['👅','badan'],
 'rambut':['','badan'],
 'bibir':['👄','badan'],
 'perut':['','badan'],
 'duduk':['',''],
 'tidur':['😴',''],
 'makan':['🍽️',''],
 'minum':['🥤',''],
 'mandi':['🛁',''],
 'masak':['🍳',''],
 'tulis':['✍️',''],
 'lukis':['🎨',''],
 'main':['',''],
 'nyanyi':['🎤',''],
 'menari':['💃',''],
 'senyum':['😊',''],
 'menangis':['😢',''],
 'ketawa':['😂',''],
 'besar':['',''],
 'kecil':['',''],
 'panas':['',''],
 'sejuk':['',''],
 'cantik':['',''],
 'lapar':['',''],
 'dahaga':['',''],
 'gembira':['😀',''],
 'sedih':['😢',''],
 'merah':['🔴',''],
 'kuning':['🟡',''],
 'hitam':['⚫',''],
 'putih':['⚪',''],
 'ungu':['🟣',''],
 'naik':['',''],
 'turun':['',''],
 'buka':['',''],
 'tutup':['',''],
 'tolak':['',''],
 'tarik':['',''],
 'lompat':['',''],
 'masuk':['',''],
 'keluar':['',''],
 'kawan':['',''],
 'sekolah':['🏫',''],
 'kelas':['',''],
 'taman':['🏞️',''],
 'kedai':['🏪',''],
 'masjid':['🕌',''],
 'pasar':['',''],
 'dapur':['🍳',''],
 'bilik':['🛏️',''],
 'nama':['',''],
 'suku':['',''],
 'aku':['',''],
 'sini':['',''],
 'kita':['',''],
 'pita':['🎀','benda'],
 'cuba':['',''],
 'cuti':['',''],
 'kaca':['',''],
 'lagu':['🎵',''],
 'bulu':['🪶',''],
 'duku':['','makanan'],
 'pari':['',''],
 'tari':['',''],
 'duri':['',''],
 'labu':['🎃','makanan'],
 'sawa':['🐍','haiwan'],
 'kuali':['🍳','']
};
for(const w in WB){if(WB[w][0]&&!PIC[w])PIC[w]=WB[w][0];}
const BA_LET=['','aiunb','msk','tycp','dglr','hjwfz'];
function wStage(w){const sy=sukuKata(w),s=w.replace(/-/g,'');
  if(/ng|ny|sy|kh|gh/.test(s)||sy.some(x=>/(ai|au|oi)$/.test(x)))return 8;
  if(/[oeé]/.test(s))return 7;
  const closed=sy.filter(x=>!/[aiu]$/.test(x));
  if(closed.length)return closed.every(x=>/[nkmr]$/.test(x))?6:7;
  for(let b=1;b<=5;b++){const L=BA_LET.slice(1,b+1).join('');if([...s].every(c=>L.includes(c)))return b;}
  return 8;}
const CAT={};for(const w in WB){const c=WB[w][1];if(c)(CAT[c]=CAT[c]||[]).push(w);}
