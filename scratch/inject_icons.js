const fs = require('fs');
const path = 'c:/Users/Alexander Ayavaca/Desktop/control7/src/components/ia-client.tsx';

try {
    let data = fs.readFileSync(path, 'utf8');

    // 1. Tanque Pulmón (Update icon)
    data = data.replace(
        /<Droplets className="h-5 w-5 text-blue-500" \/>\s+Tanque Pulmón/,
        '<Waves className="h-5 w-5 text-blue-500" />\n                                                   Tanque Pulmón'
    );

    // 2. Centrífugas title (Add icon)
    data = data.replace(
        /h3 className="font-bold text-lg flex items-center gap-2">\s+Centrífugas/,
        'h3 className="font-bold text-lg flex items-center gap-2">\n                                                <RotateCw className="h-5 w-5 text-primary" />\n                                                Centrífugas'
    );

    // 3. Silos (Update h3)
    data = data.replace(
        /<h3 className="font-bold text-lg">\{simSilo\.name\}<\/h3>/,
        '<h3 className="font-bold text-lg flex items-center gap-2">\n                                              <Database className="h-5 w-5 text-primary" />\n                                              {simSilo.name}\n                                          </h3>'
    );

    // 4. Máquinas (Update Label)
    data = data.replace(
        /<Label className="font-bold text-primary">Máquina \{machine\.id\}<\/Label>/,
        '<Label className="font-bold text-primary flex items-center gap-2">\n                                                  <Box className="h-4 w-4" /> Máquina {machine.id}\n                                              </Label>'
    );

    // 5. Enfardadoras (Update Label)
    data = data.replace(
        /<Label className="font-bold text-primary">\{wrapperConfig\.name\}<\/Label>/,
        '<Label className="font-bold text-primary flex items-center gap-2">\n                                              <Package2 className="h-4 w-4" /> {wrapperConfig.name}\n                                          </Label>'
    );

    fs.writeFileSync(path, data, 'utf8');
    console.log('Successfully injected icons into ia-client.tsx.');
} catch (err) {
    console.error('Error injecting icons:', err);
    process.exit(1);
}
