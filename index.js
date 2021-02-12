const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');

yargs(hideBin(process.argv)).option('filter', {
    alias: 'f',
    type: 'regex',
    description: 'regex (greplike) string to filter the input filename'
}).option('sheetname', {
    alias: 's',
    type: 'string',
    description: 'the name of the sheet to be processed'
}).command('extract [source] [target] [mappingfile]', 
'extract column(s) from source folder to target folder', (yargs)=>{
    yargs.positional('source', {
        describe: 'source folder',
        default: '.'
    });
    yargs.positional('target', {
        describe: 'target folder',
        default: '..'
    });
    yargs.positional('mappingfile', {
        describe: 'json rule to extract the information(s)',
        default: 'mapping.json'
    });
}, (argv)=>{
    let rule = JSON.parse(fs.readFileSync(argv.mappingfile).toString());
    extract(argv.source, argv.target, rule, argv.filter, argv.sheetname);
}).command('merge [source] [target]', 
'merge xlsx files from source folder to target file', (yargs)=>{
    yargs.positional('source', {
        describe: 'source folder',
        default: '.'
    });
    yargs.positional('target', {
        describe: 'target file',
        default: 'target.xlsx'
    });
}, (argv)=>{
    merge(argv.source, argv.target, argv.filter, argv.sheetname);
}).argv

function merge(source, target, filterstring, sheetname) {
    console.log("merging from",source,"to",target);
    let files = fs.readdirSync(source);
    let filterRegex = filterstring? new RegExp(filterstring): undefined;
    let filter = filterRegex? x=>filterRegex.test(x) : x=>true;
    let resBook = XLSX.utils.book_new();
    let resSheets = {};
    for(let filename of files){
        if(fs.lstatSync(path.join(source,filename)).isDirectory() ) continue;
        if(!filename.endsWith(".xlsx")) continue;
        if(!filter(filename)) continue;
        console.log("Reading from", filename);
        let workbook = XLSX.readFile(path.join(source,filename));
        if(sheetname && workbook.SheetNames.indexOf(sheetname)==-1){
            console.error("sheet",sheetname,"does not found in file",filename);
            continue;
        }
        let sheets = sheetname? [sheetname] : workbook.SheetNames;
        console.log("sheets to be merged",sheets); 
        for(let activeSheet of sheets) {
            let worksheet = workbook.Sheets[activeSheet];
            let data = XLSX.utils.sheet_to_json(worksheet);
            if(resSheets[activeSheet]){
                resSheets[activeSheet] = resSheets[activeSheet].concat(data);
            }else{
                resSheets[activeSheet] = data;
            }
        }
    }
    for(let sn of Object.keys(resSheets)) {
        let tempSheet = XLSX.utils.json_to_sheet(resSheets[sn]);
        XLSX.utils.book_append_sheet(resBook, tempSheet, sn);
    }
    XLSX.writeFile(resBook, target);

}

function extract(source, target, rule, filterstring, sheetname) {
    console.log("extracting from",source,"to",target);
    let files = fs.readdirSync(source);
    let filterRegex = filterstring? new RegExp(filterstring): undefined;
    let filter = filterRegex? x=>filterRegex.test(x) : x=>true;
    for(let filename of files){
        if(fs.lstatSync(path.join(source,filename)).isDirectory() ) continue;
        if(!filename.endsWith(".xlsx")) continue;
        if(!filter(filename)) continue;
        console.log("Extracting from", filename);
        let workbook = XLSX.readFile(path.join(source,filename));
        if(sheetname && workbook.SheetNames.indexOf(sheetname)==-1){
            console.error("sheet",sheetname,"does not found in file",filename);
            continue;
        }
        let sheets = sheetname? [sheetname] : workbook.SheetNames;
        console.log("sheets to be processed",sheets); 
        for(let activeSheet of sheets) {
            let worksheet = workbook.Sheets[activeSheet];
            let data = XLSX.utils.sheet_to_json(worksheet)
            let result = [];
            for(let row of data){
                let rowres = {};
                for(let colRule of rule){
                    for(let colMap of colRule.source) {
                        if(row[colMap]) {
                            rowres[colRule.colname] = row[colMap];
                            break;
                        }
                    }
                }
                result.push(rowres);
            }
            let resBook = XLSX.utils.book_new();
            let resSheet = XLSX.utils.json_to_sheet(result);
            XLSX.utils.book_append_sheet(resBook, resSheet, 'result');
            let sheetExtFn = sheets.length>1?'':activeSheet;
            XLSX.writeFile(resBook, path.join(target,filename.substr(0,filename.length-5)+sheetExtFn+".xlsx"));
        }
    }
}