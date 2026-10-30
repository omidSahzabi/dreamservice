// Synthetic, deterministic contract cases shared by unit and disposable-PG tests.
const canonicalExamples=['09812345678','09800000000','09899999999','09123456789','09351234567','09901234567'];
const digitSets=['0123456789','۰۱۲۳۴۵۶۷۸۹','٠١٢٣٤٥٦٧٨٩'];
export const validPhoneCases=canonicalExamples.flatMap(canonical=>{
  const national=canonical.slice(1),forms=[canonical,national,'98'+national,'+98'+national,'0098'+national];
  return forms.flatMap(form=>{
    const formats=[form,' '+form.replace(/([0-9]{3})(?=[0-9])/g,'$1 ')+' ',form.replace(/([0-9]{3})(?=[0-9])/g,'$1-'),form.startsWith('+')?'+('+form.slice(1)+')':'('+form+')'];
    return formats.flatMap(value=>[...digitSets.map(digits=>value.replace(/[0-9]/g,d=>digits[+d])),value.replace(/[0-9]/g,(d,i)=>digitSets[i%3][+d])].map(input=>({input,canonical})));
  });
});

export const invalidPhoneCases=[
  null,undefined,'',' ','0','09','912345678','91234567890','08123456789',
  '0912345678','091234567890','981234567','98123456789','98981234567','9898123456789',
  '009812345678','009898123456789','000989812345678','009809812345678',
  '+09123456789','+9812345678','+00989123456789','+979123456789','++989812345678',
  '98+9812345678','+98+9812345678','phone:09812345678','09812345678abc',
  '098a12345678','09812345678.0','09/812/345/678','09--812345678','-09812345678',
  '09812345678-','(09812345678','09812345678)','((09812345678))','()09812345678',
  '(09-812)345678','(+98)9812345678','09812345678\n','\t09812345678',
  '09812345678\r','09812345678\0','09812345678\u200c','098\u00a012345678',
  '098\u201312345678','０９８１２３４５６７８','1e09812345678',
  '9'.repeat(4096)+'-',
];
