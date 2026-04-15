#set($NameLower = $Name.toLowerCase())
#if ($Autocomplete == 'true') const AutocompleteCommand = require('../../structures/AutocompleteCommand');
#else const Command = require('../../structures/Command');#end

class $Name extends #if($Autocomplete == 'true') AutocompleteCommand #else Command#end {

    constructor() {
        super('$NameLower');
    }

    #if($Autocomplete == 'true')
    autocomplete(interaction, client) {
    
    }
    
    #end
    execute(interaction, client, args) {
    
    }
}

module.exports = $Name
