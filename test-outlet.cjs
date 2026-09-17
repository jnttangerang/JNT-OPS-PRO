const outlets = [{ outlet_id: 'OUT-001', kode_outlet: 'TGR01' }];
const rawOutlet = 'out-001';
const found = outlets.find(o => Object.values(o).some(v => String(v).toLowerCase() === rawOutlet));
console.log(found);
