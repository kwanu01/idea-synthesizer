const fs=require('fs');const parser=require('@babel/parser');
const f=process.argv[2];const code=fs.readFileSync(f,'utf8');
try{parser.parse(code,{sourceType:'module',plugins:['jsx']});console.log('OK');}
catch(e){console.log('FAIL',e.message);process.exit(1);}
