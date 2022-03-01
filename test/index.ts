import { assert } from 'console';
import path from 'path';
import { FullResults, VerifyResults, DuplicityWrapper, ListCurrentFilesResults, ListFileEntry, TimeSpanOption, RemoveOlderThanResults, RemoveAllButNFullResults } from '../src/index'

async function main(): Promise<void> {
    const app = process.env.DUPLICITY_PATH ?? '/usr/bin/duplicity';

    try {
        let c1 = new DuplicityWrapper(app);
        console.log(`c1 created ${c1.version}`);
    }
    catch (err: any) {
        console.log(`error c1 - ${err}`);
        assert(false, 'Error should not have been thrown')
    }

    try {
        let c2 = new DuplicityWrapper();
        console.log(`c2 created ${c2.version}`);
    }
    catch (err: any) {
        console.log(`error c2 - ${err}`);
        assert(false, 'Error should not have been thrown')
    }

    try {
        let c3 = new DuplicityWrapper('/bs/path/duplicity');
        console.log(`c3 created ${c3.version}`);
        assert(false, 'Error should have been thrown')
    }
    catch (err: any) {
        console.log(`expected error c3 - ${err}`);
    }

    let ts = TimeSpanOption.fromDays(1);
    let d = new Date();
    console.log(ts.addToDate(d).toLocaleString());
    console.log(ts.subtractFromDate(d).toLocaleString());

    let ty = TimeSpanOption.fromDuplicitySpan('2W');
    console.log(ty.addToDate(d).toLocaleString());
    console.log(ty.subtractFromDate(d).toLocaleString());

    ty = TimeSpanOption.fromDuplicitySpan('2W1D1h130m');
    console.log(ty.addToDate(d).toLocaleString());
    console.log(ty.subtractFromDate(d).toLocaleString());


    let test = new DuplicityWrapper();


    console.log(process.cwd());
    console.log(path.resolve(__dirname, '../..'));
    let result: FullResults;
    try {
        result = await test.commandFull({ target: './nosuchdirectory', url: 'file://testout', passPhrase: 'markmark', cwd: path.resolve(__dirname, '../..'), extraArgs: '--verbosity info' } );
        assert(true, 'Should have thrown an error');
    }
    catch (err: any) {
        console.log(`Expected error thrown: ${err.message}`);
    }
    result = await test.commandFull({ target: './testin', url: 'file://testout', passPhrase: 'markmark', cwd: path.resolve(__dirname, '../..'), extraArgs: '--verbosity info' } );
    console.log(`Returned ${result.rc} full = ${result.FullBackup }`);
    console.log(result.Output.stdout);
    console.log(result.Output.stderr);
    assert(result.rc == 0, `Bad return code ${result.rc}`);
    assert(result.Errors == 0, `Errors during processing ${result.Errors}`);
    assert(result.FullBackup == true, 'Expected full backup');
    // await new Promise<void>((resolve, _reject) => setTimeout(resolve, 5000));
    result = await test.commandIncr({ target: './testin', url: 'file://testout', passPhrase: 'markmark', cwd: path.resolve(__dirname, '../..'), extraArgs: [ '--verbosity', 'info'] } );
    console.log(`Returned ${result.rc} full = ${result.FullBackup }`);
    console.log(result.Output.stdout);
    console.log(result.Output.stderr);
    assert(result.rc == 0, `Bad return code ${result.rc}`);
    assert(result.Errors == 0, `Errors during processing ${result.Errors}`);
    assert(result.FullBackup == false, 'Expected incremental backup');
    await new Promise<void>((resolve, _reject) => setTimeout(resolve, 5000));
    result = await test.commandIncr({ target: './testin', url: 'file://testout', passPhrase: 'markmark', fullIfOlderThan: TimeSpanOption.fromSeconds(3), cwd: path.resolve(__dirname, '../..') });
    console.log(`Returned ${result.rc} full = ${result.FullBackup }`);
    console.log(result.Output.stdout);
    console.log(result.Output.stderr);
    assert(result.rc == 0, `Bad return code ${result.rc}`);
    assert(result.Errors == 0, `Errors during processing ${result.Errors}`);
    assert(result.FullBackup == true, 'Expected full backup');
    let verify: VerifyResults = await test.commandVerify({ target: './testin', url: 'file://testout', passPhrase: 'markmark', cwd: path.resolve(__dirname, '../..'), compareData: false })
    console.log(`Compared ${verify.FilesCompared}; Differences ${verify.DifferencesFound}`);
    console.log(`Last full backup at ${verify.LastFullBackupDate.toLocaleString()}`);
    console.log(verify.Output.stdout);
    console.log(verify.Output.stderr);
    assert(result.rc == 0, `Bad return code ${result.rc}`);
    process.env['PASSPHRASE'] = 'markmark';
    verify = await test.commandVerify({ target: './testin', url: 'file://testout', cwd: path.resolve(__dirname, '../..'), compareData: true })
    console.log(`Compared ${verify.FilesCompared}; Differences ${verify.DifferencesFound}`);
    let fc = verify.FilesCompared;
    console.log(verify.Output.stdout);
    console.log(verify.Output.stderr);
    assert(result.rc == 0, `Bad return code ${result.rc}`);
    delete process.env.PASSPHRASE;
    try {
        verify = await test.commandVerify({ target: './testin', url: 'file://testout', cwd: path.resolve(__dirname, '../..'), compareData: false })
        assert(false, 'This should have failed due to a lack of a passphrase');
    }
    catch(err) {
        console.log(err.message);
    }
    let list: ListCurrentFilesResults;
    list = await test.commandListCurrentFiles({ url: 'file://testout', passPhrase: 'markmark', cwd: path.resolve(__dirname, '../..') })
    list.Entries.forEach((value: ListFileEntry) => {
        let blanks = '                                                  ';
        console.log(value.FileName + blanks.substring(0, blanks.length - value.FileName.length) + value.FileTime.toISOString());
    });
    console.log(list.Output.stdout);
    console.log(list.Output.stderr);
    assert(result.rc == 0, `Bad return code ${result.rc}`);
    assert(list.Entries.length == fc, 'Wrong number of files listed');
    list = await test.commandListCurrentFiles({ url: 'file://testout', time: new Date('2022-01-27T08:00'), passPhrase: 'markmark', cwd: path.resolve(__dirname, '../..') })
    list.Entries.forEach((value: ListFileEntry) => {
        let blanks = '                                                  ';
        console.log(value.FileName + blanks.substring(0, blanks.length - value.FileName.length) + value.FileTime.toISOString());
    });
    console.log(list.Output.stdout);
    console.log(list.Output.stderr);
    assert(result.rc == 0, `Bad return code ${result.rc}`);
    let remove: RemoveAllButNFullResults;
    remove = await test.commandRemoveAllButNFull({ url: 'file://testout', count: 2, passPhrase: 'markmark', cwd: path.resolve(__dirname, '../..'), force: true });
    console.log(remove.Output.stdout);
    console.log(remove.Output.stderr);
    assert(remove.requireForce == false, 'Should not have required force');
    assert(remove.rc == 0, `Bad return code ${remove.rc}`);
    let removeOlder: RemoveOlderThanResults;
    removeOlder = await test.commandRemoveOlderThan({ url: 'file://testout', time: TimeSpanOption.fromSeconds(6), passPhrase: 'markmark', cwd: path.resolve(__dirname, '../..'), force: true });
    console.log(removeOlder.Output.stdout);
    console.log(removeOlder.Output.stderr);
    assert(removeOlder.requireForce == false, 'Should not have required force');
    assert(removeOlder.rc == 0, `Bad return code ${removeOlder.rc}`);
}

main().then(() => console.log('done'), (err) => console.log(`Error: ${err}`));