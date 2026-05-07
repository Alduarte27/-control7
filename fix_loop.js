const fs = require('fs');
const path = 'c:/Users/Alexander Ayavaca/Desktop/control7/src/components/ia-client.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix the infinite loop in useEffect by adding a ref check and ensuring machines exist
const oldEffect = `    React.useEffect(() => {
        if (Object.keys(machineConfig).length === 0) {
            const initial: Record<number, { active: boolean, productId: string, speed: number }> = {};
            machines.forEach(m => {
                initial[m.id] = {
                    active: m.isSimulatingActive && m.productId !== 'inactive',
                    productId: m.productId !== 'inactive' ? m.productId : (products[0]?.id || ''),
                    speed: m.speed || 30 
                };
            });
            setMachineConfig(initial);
        }
    }, [machines, products, machineConfig]);`;

const newEffect = `    const initializedRef = React.useRef(false);

    React.useEffect(() => {
        if (!initializedRef.current && machines.length > 0) {
            const initial: Record<number, { active: boolean, productId: string, speed: number }> = {};
            machines.forEach(m => {
                initial[m.id] = {
                    active: m.isSimulatingActive && m.productId !== 'inactive',
                    productId: m.productId !== 'inactive' ? m.productId : (products[0]?.id || ''),
                    speed: m.speed || 30 
                };
            });
            setMachineConfig(initial);
            initializedRef.current = true;
        }
    }, [machines, products]);`;

content = content.replace(oldEffect, newEffect);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed infinite loop in ProductionProjectionView initialization.');
