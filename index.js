const fs = require('fs');
const request = require('request-promise');
const chalk = require('chalk');

let _config = JSON.parse(fs.readFileSync('config.json'));
init();

async function init() {
    //clear console
    process.stdout.write('\033c');
    let start = formatDate(new Date());
    let result = [];

    //get all items from market
    let items = JSON.parse(await request('https://api.warframe.market/v1/items')).payload.items;

    console.log('Found ' + chalk.green(items.length) + ' items. Filtering sets...');

    //get the items which names end with "_set"
    let sets = items
        .filter(item => item.url_name.endsWith('_set'))
        .map(item => item.url_name);

    console.log('Found ' + chalk.green(sets.length) + ' sets. Iterating...');
    
    //for each set
    for (let i = 0; i < sets.length; ++i) {

        let name = titleCase(sets[i].slice(0, sets[i].length - 4).split('_').join(' '));
        console.log(chalk.green(i + 1) + ' / ' + sets.length + '\t' + (i < 9 ? '\t' : '') + chalk.yellow(name));

        //get sibling parts of this item (sets, blueprints, chassis, systems, barrels, links etc...)
        let setParts = JSON.parse(await request('https://api.warframe.market/v1/items/' + sets[i])).payload.item.items_in_set
            .map(item => {
                return {
                    //get its name and price in ducats
                    name: item.url_name,
                    ducats: item.ducats
                };
            })
            //make sure that "_set" item is always the first one in array
            .sort(sortBySet);

        setParts.forEach(setPart => {
            console.log(chalk.yellow('\t\t> ') + titleCase(setPart.name.split('_').join(' ')));
        });

        let ducats = setParts.map(setPart => (setPart.ducats == undefined ? 0 : setPart.ducats));
        //get existing orders for each of the existing items (including sets)
        let allPartsOrders = await Promise.all(setParts.map(setPart => request('https://api.warframe.market/v1/items/' + setPart.name + '/orders')));
        allPartsOrders = allPartsOrders.map(curPartOrders => { 
            let index = allPartsOrders.indexOf(curPartOrders);
            //filter the orders and trim object on _config.position (0 by default, thus the cheapest one - sortByPrice())
            let order = JSON.parse(curPartOrders).payload.orders
                .filter(order =>
                    order.order_type == 'sell' &&
                    order.user.status != 'offline' &&
                    order.user.reputation >= _config.min_reputation &&
                    _config.platforms.includes(order.platform) &&
                    //_config.regions.includes(order.region) &&
                    order.visible)
                .sort(sortByPrice)[_config.position];
            return {
                platinum: (order == undefined ? (setParts[index].name.endsWith('_set') ? -99999999 : 99999999) : order.platinum),
                ducats: ducats[index],
                part: 'https://warframe.market/items/' + setParts[index].name,
                user: (order == undefined ? null : 'https://warframe.market/profile/' + order.user.ingame_name),
                update: (order == undefined ? null : formatDate(new Date(order.last_update)))
            };
        });

        //calculate the amount of plat needed to buy the set's parts and their sum in ducats
        let amounts = allPartsOrders.reduce((accumulator, currentValue) => {
            if (!currentValue.part.endsWith('_set')) {
               accumulator.needed += currentValue.platinum;
               accumulator.ducats += currentValue.ducats;
            }
            return accumulator;
        }, {
            needed: 0,
            ducats: 0
        });

        //get profit = set price - sum of part prices
        let profit = allPartsOrders[0].platinum - amounts.needed;

        //slightly dirty hack to check if some order was found
        if (Math.abs(profit) > 5000) {
            console.log(chalk.red('Error: No fitting orders found.'));
            continue;
        }

        result.push({
            ...{
                profit,
                name,
                orders: allPartsOrders
            },
            ...amounts
        });
    }

    result = result.sort(sortByProfit);
    fs.writeFileSync('data.json', JSON.stringify({
        start,
        end: formatDate(new Date()),
        position: _config.position,
        result
    }, null, 2));
    process.exit();
}

function sortByPrice(a, b) {
    if (a.platinum < b.platinum) {
        return -1;
    }

    if (a.platinum > b.platinum) {
        return 1;
    }
	
    return 0;
}

function sortByProfit(a, b) {
    if (a.profit < b.profit) {
        return 1;
    }

    if (a.profit > b.profit) {
        return -1;
	}
	
    return 0;
}

function sortBySet(a, b) {
    if (a.name.includes('_set')) {
        return -1;
    }

    if (b.name.includes('_set')) {
        return 1;
    }

    return 0;
}

//https://stackoverflow.com/questions/12409299/how-to-get-current-formatted-date-dd-mm-yyyy-in-javascript-and-append-it-to-an-i
function formatDate(date) {
    let dd = date.getDate();
    let mm = date.getMonth() + 1; //January is 0!
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

    return dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + minutes + ':' + ss;
}

//https://stackoverflow.com/questions/32589197/capitalize-first-letter-of-each-word-in-a-string-javascript/32589256
function titleCase(str) {
    var splitStr = str.toLowerCase().split(' ');
    for (var i = 0; i < splitStr.length; i++) {
        // You do not need to check if i is larger than splitStr length, as your for does that for you
        // Assign it back to the array
        splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);     
    }
    // Directly return the joined string
    return splitStr.join(' '); 
 }