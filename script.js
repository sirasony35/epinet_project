document.addEventListener('DOMContentLoaded', () => {
    // 이전 코드는 모두 동일합니다... (상단 설정 및 함수들)
    const API_KEY = '8fea9c17c3a7472f9884b37fee2e2959';
    const BASE_URL = '/api';

    const nameMappings = {
        weather: {
            date: '측정일시', avgTp: '평균 기온(℃)', hghstTp: '최고 기온(℃)', lowstTp: '최저 기온(℃)',
            hm: '평균 습도(%)', rn: '강수량(mm)', avgWs: '평균 풍속(m/s)', hghstWs: '최고 풍속(m/s)',
            wd: '풍향(°)', srqty: '일사량(MJ/m²)', eptnQy: '증발산량(mm)', phypHumd: '엽면습윤'
        },
        pestRisk: {
            date: '예측일', dipNm: '병해충명', riskStepNm: '위험단계',
            ottcStartDt: '방제 시작일', ottcEndDt: '방제 종료일'
        },
        rcmdPesticide: {
            agchmNm: '농약명', sprayCount: '연중 살포횟수', rcmdtnYn: '추천여부'
        },
        prscPesticide: {
            dipNm: '병해충명', agchmNm: '농약명', prscCn: '처방내용', sprayDate: '살포일'
        }
    };
    // ★★★ 작목별 병해충 목록 데이터 추가 ★★★
    const pestOptionsByCrop = {
        'K00001': [ // 콩
            { value: 'D00001', text: '톱다리개미허리노린재' },
            { value: 'D00002', text: '세균병' }
        ],
        'K00003': [ // 벼
            { value: 'D00006', text: '도열병' },
            { value: 'D00009', text: '이화명나방' },
            { value: 'D00011', text: '세균벼알마름병' },
            { value: 'D00015', text: '벼멸구' }
        ]
    };

    const chartDatasetProps = {
        avgTp: { label: '평균 기온(℃)', borderColor: '#e63946', yAxisID: 'yTemp' },
        hghstTp: { label: '최고 기온(℃)', borderColor: '#f77f00', yAxisID: 'yTemp' },
        lowstTp: { label: '최저 기온(℃)', borderColor: '#0077b6', yAxisID: 'yTemp' },
        hm: { label: '평균 습도(%)', borderColor: '#00b4d8', yAxisID: 'yPercent' },
        rn: { label: '강수량(mm)', borderColor: '#48cae4', yAxisID: 'yMm', type: 'bar' },
        avgWs: { label: '평균 풍속(m/s)', borderColor: '#52b788', yAxisID: 'yMs' },
        hghstWs: { label: '최고 풍속(m/s)', borderColor: '#2d6a4f', yAxisID: 'yMs' },
        srqty: { label: '일사량(MJ/m²)', borderColor: '#fca311', yAxisID: 'yMj' },
        eptnQy: { label: '증발산량(mm)', borderColor: '#90e0ef', yAxisID: 'yMm', type: 'bar' },
    };

    let commonParams = {};
    let hourlyData = [], dailyData = [], pestRiskData = [], rcmdPesticideData = {}, prscPesticideData = {};
    let chartInstances = {};

    const today = new Date().toISOString().split('T')[0];
    ['weather-date', 'begin-date-daily', 'until-date-daily', 'spray-date'].forEach(id => {
        document.getElementById(id).value = today;
    });

    // --- 2. 공통 헬퍼 함수 ---

    // ★★★ 병해충 드롭다운 업데이트 함수 추가 ★★★
    function updatePestDropdown(selectedCropCode) {
        const pestDropdown = document.getElementById('dipCd');
        pestDropdown.innerHTML = ''; // 기존 옵션들을 모두 제거

        const pests = pestOptionsByCrop[selectedCropCode];
        if (pests) {
            pests.forEach(pest => {
                const option = document.createElement('option');
                option.value = pest.value;
                option.textContent = pest.text;
                pestDropdown.appendChild(option);
            });
        }
    }

    function downloadExcel(data, filename, mapping) {
        if (!data || (Array.isArray(data) && data.length === 0)) { alert('다운로드할 데이터가 없습니다.'); return; }
        const dataArray = Array.isArray(data) ? data : [data];
        const transformedData = dataArray.map(row => {
            const newRow = {};
            for (const key in mapping) { if (row.hasOwnProperty(key)) { newRow[mapping[key]] = row[key]; } }
            return newRow;
        });
        const worksheet = XLSX.utils.json_to_sheet(transformedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        XLSX.writeFile(workbook, filename);
    }

    function renderChart(containerId, canvasId, checkboxGroupName, sourceData) {
        const resultBox = document.getElementById(containerId);
        if (!resultBox) return;
        resultBox.innerHTML = `<canvas id="${canvasId}"></canvas>`;

        const selectedOptions = Array.from(document.querySelectorAll(`input[name=${checkboxGroupName}]:checked`)).map(cb => cb.value);
        if (selectedOptions.length === 0) {
            resultBox.innerHTML = '<p style="text-align:center; padding: 20px;">차트에 표시할 데이터를 선택해주세요.</p>';
            if (chartInstances[canvasId]) { chartInstances[canvasId].destroy(); delete chartInstances[canvasId]; }
            return;
        }

        const datasets = selectedOptions.map(option => ({
            ...chartDatasetProps[option],
            data: sourceData.map(d => d[option]),
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.1
        }));

        const labels = sourceData.map(d => d.date);

        if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

        const scales = {};
        datasets.forEach(ds => {
            if (!scales[ds.yAxisID]) {
                const props = chartDatasetProps[selectedOptions.find(opt => chartDatasetProps[opt].yAxisID === ds.yAxisID)];
                scales[ds.yAxisID] = {
                    type: 'linear',
                    display: true,
                    position: ['yPercent', 'yMs', 'yMj'].includes(ds.yAxisID) ? 'right' : 'left',
                    title: { display: true, text: props.label.split('(')[1].replace(')','') },
                    grid: { drawOnChartArea: ds.yAxisID === 'yTemp' }
                };
            }
        });

        chartInstances[canvasId] = new Chart(document.getElementById(canvasId).getContext('2d'), {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { type: 'time', time: { unit: checkboxGroupName.startsWith('hrly') ? 'hour' : 'day' } },
                    ...scales
                }
            }
        });
    }

    function renderTable(containerId, headers, data) {
        const container = document.getElementById(containerId);
        let tableHTML = '<table><thead><tr>';
        headers.forEach(header => tableHTML += `<th>${header.title}</th>`);
        tableHTML += '</tr></thead><tbody>';
        data.forEach(item => {
            tableHTML += '<tr>';
            headers.forEach(header => tableHTML += `<td>${item[header.key] || '-'}</td>`);
            tableHTML += '</tr>';
        });
        tableHTML += '</tbody></table>';
        container.innerHTML = tableHTML;
    }

    async function fetchData(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`서버 응답 오류 (${response.status})`);
        return await response.json();
    }

    // --- 3. 단계별 이벤트 리스너 등록 ---

    // ★★★ 페이지 로드 시, 그리고 작목 선택 변경 시 병해충 목록 업데이트 ★★★
    const cropDropdown = document.getElementById('kidofcomdtyCd');
    cropDropdown.addEventListener('change', (event) => {
        updatePestDropdown(event.target.value);
    });
    // 페이지가 처음 로드될 때, 기본 선택된 작목('콩')에 맞는 병해충 목록을 채워줍니다.
    updatePestDropdown(cropDropdown.value);

    // --- 단계 1, 2, 3 이벤트 리스너는 이전과 동일합니다. ---
    // --- 단계 1: 시간별 날씨 ---
    const step1Btn = document.getElementById('btn-step1');
    const step1ChartOptions = document.getElementById('chart-options-step1');
    step1Btn.addEventListener('click', async () => {
        commonParams.latitude = document.getElementById('latitude').value;
        commonParams.longitude = document.getElementById('longitude').value;
        const date = document.getElementById('weather-date').value.replace(/-/g, '');
        const beginTime = document.getElementById('begin-time').value.replace(':', '') + '00';
        const untilTime = document.getElementById('until-time').value.replace(':', '') + '00';
        const url = `${BASE_URL}/weather/hrly?apiKey=${API_KEY}&latitude=${commonParams.latitude}&longitude=${commonParams.longitude}&begin=${date}${beginTime}&until=${date}${untilTime}`;
        try {
            hourlyData = await fetchData(url);
            renderChart('result-step1', 'hourlyChart', 'hrly-chart-options', hourlyData);
            step1ChartOptions.classList.remove('hidden');
            document.getElementById('excel-step1').disabled = false;
            document.getElementById('step-2').classList.remove('hidden');
        } catch (error) { document.getElementById('result-step1').innerText = '데이터 조회 실패: ' + error.message; }
    });
    step1ChartOptions.addEventListener('change', () => renderChart('result-step1', 'hourlyChart', 'hrly-chart-options', hourlyData));
    document.getElementById('excel-step1').addEventListener('click', () => downloadExcel(hourlyData, 'hourly_weather.xlsx', nameMappings.weather));

    // --- 단계 2: 일별 날씨 ---
    const step2Btn = document.getElementById('btn-step2');
    const step2ChartOptions = document.getElementById('chart-options-step2');
    step2Btn.addEventListener('click', async () => {
        const begin = document.getElementById('begin-date-daily').value.replace(/-/g, '');
        const until = document.getElementById('until-date-daily').value.replace(/-/g, '');
        commonParams.beginDate = begin; commonParams.untilDate = until;
        const url = `${BASE_URL}/weather/daly?apiKey=${API_KEY}&latitude=${commonParams.latitude}&longitude=${commonParams.longitude}&begin=${begin}&until=${until}`;
        try {
            dailyData = await fetchData(url);
            renderChart('result-step2', 'dailyChart', 'daly-chart-options', dailyData);
            step2ChartOptions.classList.remove('hidden');
            document.getElementById('excel-step2').disabled = false;
            document.getElementById('step-3').classList.remove('hidden');
        } catch (error) { document.getElementById('result-step2').innerText = '데이터 조회 실패: ' + error.message; }
    });
    step2ChartOptions.addEventListener('change', () => renderChart('result-step2', 'dailyChart', 'daly-chart-options', dailyData));
    document.getElementById('excel-step2').addEventListener('click', () => downloadExcel(dailyData, 'daily_weather.xlsx', nameMappings.weather));

    // --- 단계 3: 병해충 위험도 ---
    document.getElementById('btn-step3').addEventListener('click', async () => {
        commonParams.kidofcomdtyCd = document.getElementById('kidofcomdtyCd').value;
        const url = `${BASE_URL}/dip/riskStepOttc?apiKey=${API_KEY}&latitude=${commonParams.latitude}&longitude=${commonParams.longitude}&kidofcomdtyCd=${commonParams.kidofcomdtyCd}&begin=${commonParams.beginDate}&until=${commonParams.untilDate}`;
        try {
            pestRiskData = await fetchData(url);
            const headers = Object.keys(nameMappings.pestRisk).map(key => ({ title: nameMappings.pestRisk[key], key: key }));
            renderTable('result-step3', headers, pestRiskData);
            document.getElementById('excel-step3').disabled = false;
            document.getElementById('step-4').classList.remove('hidden');
        } catch (error) { document.getElementById('result-step3').innerText = '데이터 조회 실패: ' + error.message; }
    });
    document.getElementById('excel-step3').addEventListener('click', () => downloadExcel(pestRiskData, 'pest_risk.xlsx', nameMappings.pestRisk));

    // --- 단계 4: 추천 농약 ---
    document.getElementById('btn-step4').addEventListener('click', async () => {
        commonParams.dipCd = document.getElementById('dipCd').value;
        commonParams.sprayYmd = document.getElementById('spray-date').value.replace(/-/g, '');
        const url = `${BASE_URL}/agchm?apiKey=${API_KEY}&latitude=${commonParams.latitude}&longitude=${commonParams.longitude}&dipCd=${commonParams.dipCd}&sprayYmd=${commonParams.sprayYmd}`;
        try {
            const responseData = await fetchData(url);
            if (responseData && Array.isArray(responseData) && responseData.length > 0) {
                rcmdPesticideData = responseData[0];
                document.getElementById('result-step4').innerHTML = `<p><strong>농약살포지수:</strong> ${rcmdPesticideData.agchmSprayIdex}</p><div id="rcmd-table-container"></div>`;
                if (rcmdPesticideData.agchmSprayRcmdtnList && Array.isArray(rcmdPesticideData.agchmSprayRcmdtnList) && rcmdPesticideData.agchmSprayRcmdtnList.length > 0) {
                    const headers = Object.keys(nameMappings.rcmdPesticide).map(key => ({ title: nameMappings.rcmdPesticide[key], key: key }));
                    renderTable('rcmd-table-container', headers, rcmdPesticideData.agchmSprayRcmdtnList);
                } else {
                    document.getElementById('rcmd-table-container').innerHTML = "<p>추천된 농약 정보가 없습니다.</p>";
                }
                document.getElementById('excel-step4').disabled = false;
                document.getElementById('step-5').classList.remove('hidden');
            } else {
                document.getElementById('result-step4').innerHTML = '<p>조회된 추천 농약 데이터가 없습니다.</p>';
                rcmdPesticideData = {};
            }
        } catch (error) { document.getElementById('result-step4').innerText = '데이터 조회 실패: ' + error.message; }
    });
    document.getElementById('excel-step4').addEventListener('click', () => {
        if (rcmdPesticideData && rcmdPesticideData.agchmSprayRcmdtnList) {
            downloadExcel(rcmdPesticideData.agchmSprayRcmdtnList, 'recommended_pesticide.xlsx', nameMappings.rcmdPesticide)
        } else {
            alert('다운로드할 추천 농약 목록이 없습니다.');
        }
    });

    // --- ★★★ 단계 5: 농약 사용 처방 (수정된 부분) ★★★ ---
    document.getElementById('btn-step5').addEventListener('click', async () => {
        commonParams.agchmNm = document.getElementById('agchmNm').value;
        const url = `${BASE_URL}/adwTotal?apiKey=${API_KEY}&latitude=${commonParams.latitude}&longitude=${commonParams.longitude}&dipCd=${commonParams.dipCd}&sprayYmd=${commonParams.sprayYmd}&agchmNm=${commonParams.agchmNm}`;
        try {
            // API 응답은 배열이므로, responseData 변수에 우선 저장합니다.
            const responseData = await fetchData(url);

            // ★★★ FIX: API 응답이 배열이고, 비어있지 않은지 확인합니다. ★★★
            if (responseData && Array.isArray(responseData) && responseData.length > 0) {
                // 배열의 첫 번째 요소를 실제 데이터로 사용합니다.
                prscPesticideData = responseData[0];
                document.getElementById('result-step5').innerHTML = `<p><strong>처방내용:</strong> ${prscPesticideData.prscCn || '처방 내용이 없습니다.'}</p>`;
                document.getElementById('excel-step5').disabled = false;
            } else {
                // API가 빈 배열 또는 유효하지 않은 데이터를 반환한 경우
                document.getElementById('result-step5').innerHTML = '<p>조회된 처방 내용이 없습니다.</p>';
                prscPesticideData = {}; // 데이터 초기화
            }
        } catch (error) {
            document.getElementById('result-step5').innerText = '데이터 조회 실패: ' + error.message;
        }
    });
    document.getElementById('excel-step5').addEventListener('click', () => downloadExcel(prscPesticideData, 'pesticide_prescription.xlsx', nameMappings.prscPesticide));
});