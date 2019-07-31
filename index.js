const fs = require('fs');
const request = require('request-promise');
const chalk = require('chalk');
const clipboardy = require('clipboardy');
const os = require('os');
let _config = {};
let error = false;
let start = new Date();
readConfig();
if (!error) {
    if (process.argv.length <= 2) {
        parse();
    } else if (process.argv.includes('--consolidation') || process.argv.includes(
            '-c')) {
        process.stdout.write('\033c');
        consolidate();
        setInterval(consolidate, _config.consolidation.interval);
    }
}
async function consolidate() {
    console.log(formatDate(new Date()) + " - condolidation started...");
    let consolidatedData = {};
    try {
        consolidatedData = JSON.parse(fs.readFileSync('consolidatedData.json'));
    }
    catch (e) {
        console.log("consolidatedData.json not found, will create anew.")
    }
    let items = await getAllItems();
    console.log('Found ' + chalk.green(items.length) +
        ' items.');
    if (items.hasOwnProperty('exception')) {
        console.log(items.exception);
        return;
    }
    for (let i = 0; i < items.length; ++i) {
        let name = titleCase(items[i].url_name.split('_').join(' '));
        console.log(chalk.green(i + 1) + ' / ' + items.length + '\t' + (i <
            9 ? '\t' : '') + chalk.yellow(name));
        let thisItemOrders = {};
        try {
            thisItemOrders = JSON.parse(await getItemOrders(items[i].url_name)).payload.orders;
        }
        catch (e) {
            console.log("Error while getting item\'s orders: " + items[i].url_name);
            continue;
        }

        let newObj = {};
        newObj[formatDate(new Date())] = thisItemOrders.filter(filterOrders)
            .sort()[items[i].url_name.endsWith('_set') ? _config.filter.set_position :
            _config.filter.part_position].platinum;
        consolidatedData[name] = { ...consolidatedData[name], ...newObj};
    }
    console.log("Writing to file. Waiting for the next iteration...");
    fs.writeFileSync('consolidatedData.json', JSON.stringify(consolidatedData, null, 2));
}
async function parse() {
    process.stdout.write('\033c');
    start = new Date();
    let result = [];
    console.log("Parser started...");
    let items = await getAllItems();
    if (items.hasOwnProperty('exception')) {
        console.log(items.exception);
        return;
    }
    console.log('Found ' + chalk.green(items.length) +
        ' items. Filtering sets...');
    let sets = items.filter(item => item.url_name.endsWith('_set'))
        .map(item => item.url_name);
    console.log('Found ' + chalk.green(sets.length) + ' sets. Iterating...');
    for (let i = 0; i < sets.length; ++i) {
        let name = titleCase(sets[i].slice(0, sets[i].length - 4)
            .split('_')
            .join(' '));
        console.log(chalk.green(i + 1) + ' / ' + sets.length + '\t' + (i <
            9 ? '\t' : '') + chalk.yellow(name));
        let siblingItems = await getSiblingItems(sets[i]);
        if (siblingItems.hasOwnProperty('exception')) {
            console.log(siblingItems.exception);
            continue;
        }
        let setParts = siblingItems.map(item => {
                return {
                    name: item.url_name,
                    ducats: item.ducats
                };
            })
            .sort((a, b) => {
                if (a.name.includes('_set')) {
                    return -1;
                }
                if (b.name.includes('_set')) {
                    return 1;
                }
                return 0;
            });
        if (_config.filter.only_warframes && !setParts.some(setPart =>
                setPart.name.includes("neuroptics"))) {
            console.log("Only warframes. Skipping...");
            continue;
        }
        let ducats = setParts.map(setPart => (setPart.ducats == undefined ?
            0 : setPart.ducats));
        let allPartsOrders = {};
        try {
            allPartsOrders = await Promise.all(setParts.map(setPart =>
                getItemOrders(setPart.name)));
        }
        catch (e) {
            console.log(chalk.red("Error while getting orders for " + setParts.map(setPart => setPart.name)));
            continue;
        }
        setParts.forEach(setPart => {
            console.log(chalk.yellow('\t\t> ') + titleCase(setPart.name
                .split('_')
                .join(' ')));
        });
        allPartsOrders = allPartsOrders.map((curPartOrders, index) => {
            let sortedOrders = JSON.parse(curPartOrders)
                .payload.orders.filter(filterOrders)
                .sort(sortByPlat);
            let position = index == 0 ? _config.filter.set_position :
                _config.filter.part_position;
            let order = sortedOrders[position >= sortedOrders.length ?
                sortedOrders.length - 1 : position];
            if (order != undefined) {
                return {
                    platinum: order.platinum,
                    ducats: ducats[index],
                    message: '/w ' + order.user.ingame_name +
                        ' hi! ' + ((_config.filter.type == 'sell') ?
                            'wtb your ' : 'wts my ') + (setParts[
                                index].name.includes('blueprint') ?
                            ('[' + titleCase(setParts[index].name.split(
                                    '_')
                                .slice(0, -1)
                                .join(' ')) + '] bp') : ('[' +
                                titleCase(setParts[index].name.split(
                                        '_')
                                    .join(' ')) + ']')) + (_config.parse
                            .plat_in_message ? ' for ' + order.platinum +
                            ' :platinum:' : '') + ' :)',
                    region: order.region,
                    part: 'https://warframe.market/items/' +
                        setParts[index].name,
                    user: 'https://warframe.market/profile/' +
                        order.user.ingame_name,
                    update: formatDate(new Date(order.last_update))
                };
            }
        });
        if (allPartsOrders.some(value => value == undefined)) {
            console.log(chalk.red('Error: No fitting orders found.'));
            continue;
        }
        let amounts = allPartsOrders.reduce((accumulator, currentValue,
            index) => {
            accumulator.needed += index == 0 ? 0 : currentValue.platinum;
            accumulator.ducats += currentValue.ducats;
            return accumulator;
        }, {
            needed: 0,
            ducats: 0
        });
        if (amounts.needed > _config.filter.max_needed) {
            console.log(chalk.red('Error: No fitting orders found.'));
            continue;
        }
        result.push({... {
                profit: allPartsOrders[0].platinum - amounts.needed,
                name,
                orders: allPartsOrders
            }, ...amounts
        });
    }
    result = result.sort((a, b) => {
        if (a.profit < b.profit) {
            return _config.filter.type == 'sell' ? 1 : -1;
        }
        if (a.profit > b.profit) {
            return _config.filter.type == 'sell' ? -1 : 1;
        }
        return 0;
    });
    let end = new Date();
    let formattedEnd = formatDate(end);
    if (_config.parse.copy_messages_to_clipboard) {
        clipboardy.writeSync(result[_config.parse.result_to_copy_messages_from]
            .orders.map(order => order.message)
            .slice(1)
            .join(os.EOL));
    }
    let filePath = 'data.json';
    /*_config.parse.folder + '/' + formattedEnd.split(' ')
        .join('/') + '.json';
    if (!fs.existsSync(_config.parse.folder)) {
        fs.mkdirSync(_config.parse.folder);
        let secondFolder = filePath.split('/')
            .slice(0, -1)
            .join('/');
        if (!fs.existsSync(secondFolder)) {
            fs.mkdirSync(secondFolder);
        }
        fs.openSync(filePath, 'w');
    }*/
    fs.writeFileSync(filePath, JSON.stringify({
        config: (_config.put_config_in_output ? _config : null),
        start: formatDate(start),
        end: formattedEnd,
        duration: differenceInSeconds(start, end),
        result
    }, null, 2));
    process.exit();
}

function formatDate(date) {
    let dd = date.getDate();
    let mm = date.getMonth() + 1;
    let yyyy = date.getFullYear();
    let hh = date.getHours();
    let minutes = date.getMinutes();
    var ss = date.getSeconds();
    if (dd < 10) {
        dd = '0' + dd;
    }
    if (mm < 10) {
        mm = '0' + mm;
    }
    if (hh < 10) {
        hh = '0' + hh;
    }
    if (minutes < 10) {
        minutes = '0' + minutes;
    }
    if (ss < 10) {
        ss = '0' + ss;
    }
    return dd + '.' + mm + '.' + yyyy + ' ' + hh + ':' + minutes + ':' + ss;
}

function readConfig() {
    _config = JSON.parse(fs.readFileSync('config.json'));
    let typeValues = ['buy', 'sell'];
    let platformValues = ['pc', 'ps4', 'xbox'];
    let statusValues = ['ingame', 'online', 'offline'];
    let regionValues = ['en', 'ru', 'fr', 'de', 'ko', 'zh', 'sv'];
    if (!_config.filter.hasOwnProperty('type') || !typeValues.includes(
            _config.filter.type)) {
        error = true;
        console.log(chalk.red('Error, type can only be a part of [' +
            typeValues.map(value => "'" + value + "'")
            .join(', ') + ']'));
    } else if (!_config.filter.hasOwnProperty('platforms') || !_config.filter
        .platforms || _config.filter.platforms.length == 0 || !_config.filter
        .platforms.every(platform => platformValues.includes(platform))) {
        error = true;
        console.log(chalk.red('Error, platforms can only be a part of [' +
            platformValues.map(value => "'" + value + "'")
            .join(', ') + ']'));
    } else if (!_config.filter.hasOwnProperty('statuses') || !_config.filter
        .statuses || _config.filter.statuses.length == 0 || !_config.filter
        .statuses.every(status => statusValues.includes(status))) {
        error = true;
        console.log(chalk.red('Error, statuses can only be a part of [' +
            statusValues.map(value => "'" + value + "'")
            .join(', ') + ']'));
    } else if (!_config.filter.hasOwnProperty('regions') || !_config.filter
        .regions || _config.filter.regions.length == 0 || !_config.filter.regions
        .every(region => regionValues.includes(region))) {
        error = true;
        console.log(chalk.red('Error, regions can only be a part of [' +
            regionValues.map(value => "'" + value + "'")
            .join(', ') + ']'));
    }
}
async function getAllItems() {
    let result = {};
    try {
        result = JSON.parse(await request(
                'https://api.warframe.market/v1/items'))
            .payload.items;
    } catch (e) {
        result['exception'] = chalk.red('Error while getting item list...');
    }
    return result;
}
async function getSiblingItems(itemName) {
    let result = {};
    try {
        result = JSON.parse(await request(
                'https://api.warframe.market/v1/items/' + itemName))
            .payload.item.items_in_set
    } catch (e) {
        result['exception'] = chalk.red(
            'Error while getting item\'s siblings: ' + itemName);
    }
    return result;
}
async function getItemOrders(itemName) {
    return request('https://api.warframe.market/v1/items/' + itemName +
        '/orders');
}

function differenceInSeconds(date1, date2) {
    return Math.abs(date1.getTime() - date2.getTime()) / 1000;
}

function differenceInDays(date1, date2) {
    return differenceInSeconds(date1, date2) / (60 * 60 * 24);
}

function filterOrders(order) {
    return order.order_type == _config.filter.type && _config.filter.statuses
        .includes(order.user.status) && (order.user.reputation >= _config.filter
            .min_reputation || index == 0) && !_config.blacklist[_config.nick]
        .includes(order.user.ingame_name) && order.platinum >= _config.filter
        .min_price && order.platinum <= _config.filter.max_price && _config
        .filter.platforms.includes(order.platform) && _config.filter.regions
        .includes(order.region) && differenceInDays(start, new Date(order.last_update)) <=
        _config.filter.max_days_diff && order.visible;
}

function titleCase(str) {
    return str.toLowerCase()
        .split(' ')
        .map(word => word.charAt(0)
            .toUpperCase() + word.substring(1))
        .join(' ');
}

function sortByPlat(a, b) {
    if (a.platinum < b.platinum) {
        return _config.filter.type == 'sell' ? -1 : 1;
    }
    if (a.platinum > b.platinum) {
        return _config.filter.type == 'sell' ? 1 : -1;
    }
    return 0;
}
