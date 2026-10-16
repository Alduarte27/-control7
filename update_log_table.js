const fs = require('fs');
const filePath = 'c:/Users/Alexander Ayavaca/Desktop/control7/src/components/log-table-client.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Update rows.push
content = content.replace(
\            m1_obs,
            m1_val,
            m2_obs,
            m2_val,
            m3_obs,
            m3_val,
            m4_obs,
            m4_val,
            m5_obs,
            m5_val,
            m6_obs,
            m6_val,\,
\            m1_obs,
            m1_val,
            m1_speed,
            m2_obs,
            m2_val,
            m2_speed,
            m3_obs,
            m3_val,
            m3_speed,
            m4_obs,
            m4_val,
            m4_speed,
            m5_obs,
            m5_val,
            m6_obs,
            m6_val,
            m7_obs,
            m7_val,
            m8_obs,
            m8_val,\
);

// 2. Update csv export headers
content = content.replace(
\        'Tecnotok #1 (Valor)',
        'Tecnotok #2 (Obs)',
        'Tecnotok #2 (Valor)',
        'Tecnotok #3 (Obs)',
        'Tecnotok #3 (Valor)',
        'Tecnotok #4 (Obs)',
        'Tecnotok #4 (Valor)',
        'Granelera #1 (Obs)',
        'Granelera #1 (Valor)',
        'Granelera #2 (Obs)',
        'Granelera #2 (Valor)',
        'Masa',\,
\        'Tecnotok #1 (Valor)',
        'Tecnotok #1 (Peso Funda)',
        'Tecnotok #2 (Obs)',
        'Tecnotok #2 (Valor)',
        'Tecnotok #2 (Peso Funda)',
        'Tecnotok #3 (Obs)',
        'Tecnotok #3 (Valor)',
        'Tecnotok #3 (Peso Funda)',
        'Tecnotok #4 (Obs)',
        'Tecnotok #4 (Valor)',
        'Tecnotok #4 (Peso Funda)',
        'Granelera #1 (Obs)',
        'Granelera #1 (Valor)',
        'Granelera #2 (Obs)',
        'Granelera #2 (Valor)',
        'Enfardadora #1 (Obs)',
        'Enfardadora #1 (Valor)',
        'Enfardadora #2 (Obs)',
        'Enfardadora #2 (Valor)',
        'Masa',\
);

// 3. Update csv export rows
content = content.replace(
\        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,\,
\        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,
        \\"\\\"\\,\
);

// 4. Update table <thead>
content = content.replace(
\<th className="p-2.5 min-w-[5.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #1 (Val)</th>
                        <th className="p-2.5 min-w-[8.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #2 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #2 (Val)</th>
                        <th className="p-2.5 min-w-[8.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #3 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #3 (Val)</th>
                        <th className="p-2.5 min-w-[8.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #4 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #4 (Val)</th>
                        <th className="p-2.5 min-w-[9rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Granelera #1 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Granelera #1 (Val)</th>
                        <th className="p-2.5 min-w-[9rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Granelera #2 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Granelera #2 (Val)</th>
                        <th className="p-2.5 min-w-[4rem] bg-emerald-100/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100">Masa</th>\,
\<th className="p-2.5 min-w-[5.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #1 (Val)</th>
                        <th className="p-2.5 min-w-[6rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #1 (Peso Funda)</th>
                        <th className="p-2.5 min-w-[8.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #2 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #2 (Val)</th>
                        <th className="p-2.5 min-w-[6rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #2 (Peso Funda)</th>
                        <th className="p-2.5 min-w-[8.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #3 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #3 (Val)</th>
                        <th className="p-2.5 min-w-[6rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #3 (Peso Funda)</th>
                        <th className="p-2.5 min-w-[8.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #4 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #4 (Val)</th>
                        <th className="p-2.5 min-w-[6rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #4 (Peso Funda)</th>
                        <th className="p-2.5 min-w-[9rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Granelera #1 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Granelera #1 (Val)</th>
                        <th className="p-2.5 min-w-[9rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Granelera #2 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Granelera #2 (Val)</th>
                        <th className="p-2.5 min-w-[9rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Enfardadora #1 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Enfardadora #1 (Val)</th>
                        <th className="p-2.5 min-w-[9rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Enfardadora #2 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Enfardadora #2 (Val)</th>
                        <th className="p-2.5 min-w-[4rem] bg-emerald-100/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100">Masa</th>\
);

// 5. Update table <tbody>
content = content.replace(
\<td className="p-2">{row.m1_val}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m2_obs}>{row.m2_obs}</td>
                          <td className="p-2">{row.m2_val}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m3_obs}>{row.m3_obs}</td>
                          <td className="p-2">{row.m3_val}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m4_obs}>{row.m4_obs}</td>
                          <td className="p-2">{row.m4_val}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m5_obs}>{row.m5_obs}</td>
                          <td className="p-2">{row.m5_val}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m6_obs}>{row.m6_obs}</td>
                          <td className="p-2">{row.m6_val}</td>
                          <td className="p-2">{row.masa}</td>\,
\<td className="p-2">{row.m1_val}</td>
                          <td className="p-2">{row.m1_speed}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m2_obs}>{row.m2_obs}</td>
                          <td className="p-2">{row.m2_val}</td>
                          <td className="p-2">{row.m2_speed}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m3_obs}>{row.m3_obs}</td>
                          <td className="p-2">{row.m3_val}</td>
                          <td className="p-2">{row.m3_speed}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m4_obs}>{row.m4_obs}</td>
                          <td className="p-2">{row.m4_val}</td>
                          <td className="p-2">{row.m4_speed}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m5_obs}>{row.m5_obs}</td>
                          <td className="p-2">{row.m5_val}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m6_obs}>{row.m6_obs}</td>
                          <td className="p-2">{row.m6_val}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m7_obs}>{row.m7_obs}</td>
                          <td className="p-2">{row.m7_val}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m8_obs}>{row.m8_obs}</td>
                          <td className="p-2">{row.m8_val}</td>
                          <td className="p-2">{row.masa}</td>\
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("done");
