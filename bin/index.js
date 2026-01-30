require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

let whitelist = [];
try {
    whitelist = JSON.parse(fs.readFileSync('./whitelist.json', 'utf8'));
} catch (err) {
    console.log("No whitelist file found, starting empty.");
}

const saveWhitelist = () => {
    fs.writeFileSync('./whitelist.json', JSON.stringify(whitelist, null, 2));
};

// --- LOGGING HELPER FUNCTION ---
async function sendToLogs(action, staff, target, details = "") {
    const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);
    if (!logChannel) return console.log("Log channel not found!");

    const logEmbed = new EmbedBuilder()
        .setTitle(`Log: ${action}`)
        .addFields(
            { name: 'Staff Member', value: `${staff.tag} (${staff.id})`, inline: true },
            { name: 'Target User', value: `${target.tag} (${target.id})`, inline: true },
            { name: 'Details', value: details || "No extra details" }
        )
        .setTimestamp()
        .setColor(action === 'User Banned' ? 'Red' : 'Green');

    await logChannel.send({ embeds: [logEmbed] });
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'whitelist') {
            if (interaction.user.id !== process.env.OWNER_ID) {
                return interaction.reply({ content: 'YOU CANNOT INTERACT WITH THIS', ephemeral: true });
            }

            const subcommand = interaction.options.getSubcommand();
            const targetUser = interaction.options.getUser('target');

            if (subcommand === 'add') {
                if (!whitelist.includes(targetUser.id)) {
                    whitelist.push(targetUser.id);
                    saveWhitelist();
                    return interaction.reply({ content: `added **${targetUser.tag}** to whitelist`, ephemeral: true });
                }
            } else if (subcommand === 'remove') {
                whitelist = whitelist.filter(id => id !== targetUser.id);
                saveWhitelist();
                return interaction.reply({ content: `removed **${targetUser.tag}** from whitelist`, ephemeral: true });
            }
        }

        if (commandName === 'moderate') {
            if (!whitelist.includes(interaction.user.id) && interaction.user.id !== process.env.OWNER_ID) {
                return interaction.reply({ content: 'YOU CANNOT INTERACT WITH THIS', ephemeral: true });
            }

            const targetUser = interaction.options.getUser('user');
            const roleToGrant = interaction.options.getRole('role_to_grant');

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`grant_${targetUser.id}_${roleToGrant.id}_${interaction.user.id}`)
                        .setLabel('be a hitter')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`ban_${targetUser.id}_none_${interaction.user.id}`)
                        .setLabel('fuck off')
                        .setStyle(ButtonStyle.Danger)
                );

            const embed = new EmbedBuilder()
                .setTitle(`${targetUser.username} DUMBASS GOT SCAMMED HAHAHAHAHAHAHAHAHH 🤣🤣🤣🤣🤣🤣🤣🤣`)
                .setDescription(`YOU GOT SCAMMED DUMBAHH NIGGER HAHAHAHAHAHAHAHAHAH`)
                .setColor('Orange');

            await interaction.reply({ 
                content: `<@${targetUser.id}>`, 
                embeds: [embed], 
                components: [row], 
                ephemeral: false 
            });
        }
    }

    if (interaction.isButton()) {
        // We split the ID: [0]action, [1]targetId, [2]roleId, [3]staffId
        const data = interaction.customId.split('_');
        const action = data[0];
        const targetId = data[1];
        const roleId = data[2];
        const staffId = data[3];

        // Debugging: This will show in your VS Code terminal
        console.log(`clicked by ${interaction.user.id} | expected: ${targetId}`);

        // 1. Check if the person clicking is the target
        if (interaction.user.id !== targetId) {
            return interaction.reply({ 
                content: 'YOU CANNOT INTERACT WITH THIS', 
                ephemeral: true 
            });
        }

        const guild = interaction.guild;
        
        // Use a Try/Catch block to handle the interaction properly
        try {
            const member = await guild.members.fetch(targetId);
            const staff = await client.users.fetch(staffId);

            if (action === 'grant') {
                const role = guild.roles.cache.get(roleId);
                if (!role) return interaction.reply({ content: 'ROLE DOESNT EXIST AYNMORE', ephemeral: true });

                await member.roles.add(role);
                
                // interaction.update removes the buttons so they can't be clicked twice
                await interaction.update({ 
                    content: `<@${targetId}> ACCEPTED`, 
                    embeds: [], 
                    components: [] 
                });
                
                await sendToLogs('accepted', staff, member.user, `role: **${role.name}**`);

            } else if (action === 'ban') {
                if (!member.bannable) {
                    return interaction.reply({ content: 'unable to ban', ephemeral: true });
                }
                
                const targetTag = member.user.tag;
                const targetUserObj = member.user;

                await member.ban({ reason: `DECLINED BRO DUMBASS ASF` });
                
                // Since the user is gone, we update the original message to show they were banned
                await interaction.update({ 
                    content: `DUMBASS **${targetTag}** DECIDED TO FUCK OFF`, 
                    embeds: [], 
                    components: [] 
                });

                await sendToLogs('BANNED', staff, targetUserObj, "CHOSE TO BE A DUMBASS AND GOT BANNED WHAT A IDIOT");
            }
        } catch (error) {
            console.error(error);
            if (!interaction.replied) {
                await interaction.reply({ content: 'error', ephemeral: true });
            }
        }
    }
});

client.login(process.env.TOKEN);
