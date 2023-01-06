require('dotenv').config()

/// VARIABLES

const puppeteer = require("puppeteer");
const sharp = require("sharp")
const { Client, GatewayIntentBits, ActivityType, Events, SlashCommandBuilder } = require('discord.js');
const { CanceledError } = require('axios');
const Bot = new Client({ intents: [GatewayIntentBits.GuildMessages] });
let DevMode = false

let AvailableCalendars = ['Lille | 3DAJV B1', 'Lille | ARCINT B1', 'Lille | AV B1', 'Lille | BRAND MAST1', 'Lille | BUSDEV MAST1', 'Lille | CLDINFRA MAST1', 'Lille | COMDMM MAST1', 'Lille | CYBSEC MAST1', 'Lille | DAMD MAST1', 'Lille | DATAENG MAST1', 'Lille | DESIG B1', 'Lille | DESIG B3 MOTD', 'Lille | DESIG B3 UXI', 'Lille | DEVLMIOT MAST1', 'Lille | DEVWEB MAST1', 'Lille | DIRART MAST1', 'Lille | DXPI MAST1', 'Lille | EXDEVOPS MAST1', 'Lille | GAMEPROG MAST1', 'Lille | INFO B1', 'Lille | INFO B3 CYBSEC', 'Lille | INFO B3 DEV', 'Lille | INFO B3 GDPROG', 'Lille | INFO B3 IADATA', 'Lille | INFO B3 INFRA', 'Lille | MARCOM B1', 'Lille | MARCOM B3 COMC', 'Lille | MARCOM B3 MARK', 'Lille | STARTUP MAST1', 'Lille | WMMDATA MAST1']

/// FUNCTIONS

Date.getWeek = function (dowOffset) {
    /*getWeek() was developed by Nick Baicoianu at MeanFreePath: http://www.meanfreepath.com */

    self = new Date()

    dowOffset = typeof(dowOffset) == 'number' ? dowOffset : 0; //default dowOffset to zero
    let newYear = new Date(self.getFullYear(),0,1);
    let day = newYear.getDay() - dowOffset; //the day of week the year begins on
    day = (day >= 0 ? day : day + 7);
    let daynum = Math.floor((self.getTime() - newYear.getTime() - 
    (self.getTimezoneOffset()-newYear.getTimezoneOffset())*60000)/86400000) + 1;
    let weeknum;
    //if the year starts before the middle of a week
    if(day < 4) {
        weeknum = Math.floor((daynum+day-1)/7) + 1;
        if(weeknum > 52) {
            let nYear = new Date(self.getFullYear() + 1,0,1);
            let nday = nYear.getDay() - dowOffset;
            nday = nday >= 0 ? nday : nday + 7;
            
            weeknum = nday < 4 ? 1 : 53;
        }
    }
    else {
        weeknum = Math.floor((daynum+day-1)/7);
    }
    return weeknum;
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let RequestCache = [];
async function GetCalendar(interaction) {
    let CalendarName = interaction.options.get("filiaire").value
    if (AvailableCalendars.indexOf(CalendarName) == -1) return interaction.reply({ content: "Filiaire incorrect.", ephemeral: true })

    let CalendarFileName = CalendarName.replaceAll("|","").replaceAll(" ", "_")
    let ImageLink = `export/${CalendarFileName}.png`
    let RawImageLink = `export/${CalendarFileName}-raw.png`

    await interaction.deferReply();

    if (!RequestCache[CalendarName] || RequestCache[CalendarName] + 3600000 < Date.now()){
        let embed = {
            "title": "Progression: démarrage..."
        }
        let msg = {embeds: [embed]}

        async function ChangeEmbed(newTitle) {
            embed.title = `Progression: ${newTitle}...`
            return await interaction.editReply(msg)
        }

        console.log(`Generating calendar ${CalendarName} for ${interaction.member.user.tag}`)

        const browser = await puppeteer.launch(process.platform == "win32" ? {} : {
            args: ['--no-sandbox']
        });
        const page = await browser.newPage();

        // Resize for screenshot quality
        page.setViewport({
            width: 1080,
            height: 720,
            deviceScaleFactor: 1,
        });

        await page.goto(process.env.url);

        // Type into search box.
        await ChangeEmbed("Authentification")
        await page.type('#username', process.env.email);
        await page.type('#password', process.env.password);

        // Wait for suggest overlay to appear and click "show all results".
        await page.click(".form > .button");

        // Allow JS
        await page.setJavaScriptEnabled(true);

        // Wait for the name to appear (which mean loading finished)
        await page.waitForSelector(".ibe_etab");
        await ChangeEmbed("Navigation")

        // Wait for the calendar button appear and click it
        let CalendarButton = (await page.$x('//*[@id="GInterface.Instances[0].Instances[1]_Wrapper"]/li[4]'))[0]
        await CalendarButton.click()

        // Wait for search box to appear and type in put
        let searchBox = (await page.$x('//*[@id="GInterface.Instances[1].Instances[1].bouton_Edit"]'))[0]
        await searchBox.type(CalendarName);
        await page.keyboard.press('Enter');

        // Wait for the results page to load and display the results. 
        await ChangeEmbed("Attente de reponse")
        await page.waitForSelector(".interface_affV_client")
        
        // Wait for the full page to show
        await sleep(3000)

        await ChangeEmbed("Finition")
        await page.screenshot({
            path: RawImageLink,
        });
        console.log("Fetched screenshot !")
        
        await browser.close();

        await sharp(RawImageLink).extract({ left: 6, top: 224, width: 1069, height: 441}).toFile(ImageLink)
        console.log("Calendar", CalendarName, "is now ready for usage !");
        RequestCache[CalendarName] = Date.now();
    }
    
    return await interaction.editReply({
        content: "", 
        files: [ImageLink],
        embeds: [
            {
                "title": `Emploi du temp ${CalendarName} pour la semaine ${Date.getWeek()}`,
                "color": 0x4af96d,
                "image": {
                    "url": "attachment://" + ImageLink.replaceAll("export/", ""),
                }
            }
        ]
    });
}

/// EVENTS

Bot.on(Events.ClientReady, () => {
    DevMode = Bot.user.id === "1060918863589543947"

    console.log("Bot is up and running !");
    console.log("We're currently running on", process.platform)
    Bot.user.setActivity('Calendar by Fab', {type: ActivityType.Streaming, url: "https://twitch.tv/fabuss255"})

    let CalendarCommand = new SlashCommandBuilder()
                            .setName("getcalendar")
                            .setDescription("Envoie une image de l'emploi du temp de la filiaire.")
                            .addStringOption(option => 
                                option.setName('filiaire')
                                        .setDescription("Spécifie la filiaire. (exemple: INFO B3 DEV")
                                        .setRequired(true)
                                        .setAutocomplete(true)
                            )
                                                       
    Bot.application.commands.set([CalendarCommand.toJSON()])
})

let Busy = false
Bot.on(Events.InteractionCreate, async interaction => {
    if (interaction.isAutocomplete()) {
        const focusedValue = interaction.options.getFocused();
        
        let CalendarChoices = []
        for (let Choice of AvailableCalendars){
            let Key = Choice.replaceAll("Lille | ", "")
            let Value = Choice

            let Args = focusedValue.split(" ")
            let Pass = true
            for (let Arg of Args){
                if (!Key.toLowerCase().match(Arg.toLowerCase()))  {
                    Pass = false
                    break
                }
            }
            if (!Pass) continue;
            
            CalendarChoices.push({name: Key, value: Value})
            if (CalendarChoices.length >= 20) break;
        }

		await interaction.respond(CalendarChoices);

        return;
    }

	if (!interaction.isChatInputCommand()) return;
    if (DevMode && (interaction.user.id != "178131193768706048")) return interaction.reply({ content: "Ceci est le bot de développement, il n'est accessible que par les développeurs.", ephemeral: true});

    if (Busy) return interaction.reply({ content: "Le bot s'occupe d'une commande, merci de patienter.", ephemeral: true })

    Busy = true
    try {
        if (interaction.commandName === 'test') {
            await interaction.reply({ content: 'Secret Pong!', ephemeral: true });
        }else if(interaction.commandName == "getcalendar"){
            await GetCalendar(interaction);
        }
    } catch(e) {
        console.log(e.stack)
        Busy = false
        return await interaction.editReply({
            "content": "",
            "tts": false,
            "embeds": [
                {
                    "title": `Une erreur est survenu !`,
                    "description": `\`\`\`\n${e.stack}\`\`\``,
                    "color": 0xf94a4a,
                    "footer": {
                        "text": `Si le problème persiste, contactez Fabuss254#0001`
                    }
                }
            ]
        });
    }
    Busy = false
});

Bot.login(process.env.token);