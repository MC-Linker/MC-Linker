module.exports = {
    name: 'enable',
    aliases: [''],
    usage: 'e.g. DISABLE',
    example: 'e.g. DISABLE',
    description: 'Enable a disabled command/stat/advancement',
    execute(message, args) {
        const enableMode = (args[0]);
        const mode = (args[1]);
        const object = (args[2]);
	}
}