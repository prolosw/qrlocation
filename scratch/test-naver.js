const lat = 37.4979;
const lng = 127.0276;

const clientId = process.env.NAVER_CLIENT_ID;
const clientSecret = process.env.NAVER_CLIENT_SECRET;

console.log('Testing NAVER MAP API reverseGeocode...');
console.log('Client ID:', clientId);
console.log('Client Secret:', clientSecret ? '***' + clientSecret.slice(-4) : 'undefined');

if (!clientId || !clientSecret) {
  console.error('Error: NAVER MAP credentials are not defined in the environment.');
  process.exit(1);
}

const url = `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&output=json&orders=roadaddr,addr`;

fetch(url, {
  headers: {
    'X-NCP-APIGW-API-KEY-ID': clientId,
    'X-NCP-APIGW-API-KEY': clientSecret,
  },
})
  .then(async (res) => {
    console.log('Response Status:', res.status);
    const data = await res.json();
    console.log('Response Body:', JSON.stringify(data, null, 2));
    
    if (data.status?.code === 0) {
      console.log('\n=== Success! Parsed Address ===');
      const roadAddrResult = data.results.find((r) => r.name === 'roadaddr');
      if (roadAddrResult) {
        const { region, land } = roadAddrResult;
        const area1 = region?.area1?.name || '';
        const area2 = region?.area2?.name || '';
        const area3 = region?.area3?.name || '';
        const roadName = land?.name || '';
        const number1 = land?.number1 || '';
        const number2 = land?.number2 || '';
        const buildingName = land?.addition0?.value || '';

        let address = `${area1} ${area2} ${area3}`.trim();
        if (roadName) address += ` ${roadName}`;
        if (number1) {
          address += ` ${number1}`;
          if (number2) address += `-${number2}`;
        }
        if (buildingName) address += ` (${buildingName})`;
        console.log('Road Address:', address);
      } else {
        console.log('No road address found.');
      }
    } else {
      console.error('API responded with error code:', data.status?.code, data.status?.message);
    }
  })
  .catch((err) => {
    console.error('Fetch Error:', err);
  });
