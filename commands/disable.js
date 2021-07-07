module.exports = {
    name: 'disable',
    aliases: [''],
    usage: 'disable command <command> **//** disable stats category/object <category/object **id**> **//** disable advancements category/advancement <category/advancement **id**>',
    example: 'disable command pingchain **//** disable stats category picked_up **//** disable advancements advancement adventuring_time **//** disable advancements category story',
    description: 'Disable a specific command/stat/advancement.',
    execute(message, args) {
        const disableMode = (args[0]);
        const mode = (args[1]);
        const object = (args[2]);
	}
}