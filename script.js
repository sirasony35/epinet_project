document.addEventListener('DOMContentLoaded', () => {
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
            ottcStartDt: '방제 시작일', ottcEndDt: '방제 종료일', addExpln: '부가설명'
        },
        rcmdPesticide: {
            pestiBrandName: '농약 상표명', indictSymbl: '작용기작', pestiUse: '사용방법',
            dilutUnit: '희석배수/사용량', useSuittime: '사용시기', useNum: '사용횟수'
        },
        prscPesticide: {
            prscTitle: '처방전 제목', prscExpln: '처방전 설명', agchmNm: '농약명',
            agchmUse: '농약 사용량', warnExpln: '주의사항', sky: '날씨', hghstTp: '예상 최고기온(℃)',
            hm: '예상 습도(%)', rn: '예상 강수량(mm)', avgWs: '예상 풍속(m/s)', totalExpln: '종합의견'
        }
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

    let pesticideInfo = [];
    let commonParams = {};
    let hourlyData = [], dailyData = [], pestRiskData = [], rcmdPesticideData = {}, prscPesticideData = {};
    let chartInstances = {};

    const today = new Date().toISOString().split('T')[0];
    ['weather-date', 'begin-date-daily', 'until-date-daily', 'spray-date', 'begin-date-pest', 'until-date-pest'].forEach(id => {
        document.getElementById(id).value = today;
    });

    async function loadPesticideInfo() {
        try {
            const response = await fetch('/농약정보.csv');
            if (!response.ok) throw new Error('농약정보.csv 파일을 불러오는 데 실패했습니다.');
            const csvText = await response.text();
            const lines = csvText.trim().split(/\r?\n/);
            pesticideInfo = lines.slice(1).map(line => {
                if (!line) return null;
                const values = line.split(',');
                return {
                    crop: values[0]?.trim(),
                    pestCode: values[1]?.trim(),
                    pestName: values[2]?.trim(),
                    brandName: values[3]?.trim()
                };
            }).filter(Boolean);
        } catch (error) {
            console.error(error);
            alert('농약 정보를 불러올 수 없습니다. 프로젝트 폴더에 `농약정보.csv` 파일이 있는지 확인해주세요.');
        }
    }

    function updatePestDropdown(selectedCropName) {
        const pestDropdown = document.getElementById('dipCd');
        pestDropdown.innerHTML = '';
        const filteredPests = pesticideInfo.filter(item => item.crop === selectedCropName);
        const uniquePests = [...new Map(filteredPests.map(item => [item.pestCode, item])).values()];
        if (uniquePests.length > 0) {
            uniquePests.forEach(pest => {
                const option = document.createElement('option');
                option.value = pest.pestCode;
                option.textContent = pest.pestName;
                pestDropdown.appendChild(option);
            });
            updatePesticideDropdown(pestDropdown.value);
        } else {
            updatePesticideDropdown(null);
        }
    }

    function updatePesticideDropdown(selectedPestCode) {
        const pesticideDropdown = document.getElementById('agchm-select');
        pesticideDropdown.innerHTML = '';
        if (!selectedPestCode) return;
        const pesticides = pesticideInfo.filter(item => item.pestCode === selectedPestCode).map(item => item.brandName);
        if (pesticides.length > 0) {
            pesticides.forEach(pesticideName => {
                const option = document.createElement('option');
                option.value = pesticideName;
                option.textContent = pesticideName;
                pesticideDropdown.appendChild(option);
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
            borderWidth: 2, pointRadius: 2, tension: 0.1
        }));
        const labels = sourceData.map(d => d.date);
        if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
        const scales = {};
        datasets.forEach(ds => {
            if (!scales[ds.yAxisID]) {
                const props = chartDatasetProps[selectedOptions.find(opt => chartDatasetProps[opt].yAxisID === ds.yAxisID)];
                if (props && props.label && props.label.includes('(')) {
                     scales[ds.yAxisID] = {
                        type: 'linear', display: true,
                        position: ['yPercent', 'yMs', 'yMj'].includes(ds.yAxisID) ? 'right' : 'left',
                        title: { display: true, text: props.label.split('(')[1].replace(')','') },
                        grid: { drawOnChartArea: ds.yAxisID === 'yTemp' }
                    };
                }
            }
        });
        chartInstances[canvasId] = new Chart(document.getElementById(canvasId).getContext('2d'), {
            type: 'line', data: { labels, datasets },
            options: {
                responsive: true, interaction: { mode: 'index', intersect: false },
                scales: { x: { type: 'time', time: { unit: checkboxGroupName.startsWith('hrly') ? 'hour' : 'day' } }, ...scales }
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

    async function initializeApp() {
        await loadPesticideInfo();

        const cropDropdown = document.getElementById('kidofcomdtyId');
        const pestDropdown = document.getElementById('dipCd');

        cropDropdown.addEventListener('change', (event) => {
            const selectedOptionText = event.target.options[event.target.selectedIndex].text;
            updatePestDropdown(selectedOptionText);
        });
        pestDropdown.addEventListener('change', (event) => {
            updatePesticideDropdown(event.target.value);
        });

        const initialCropText = cropDropdown.options[cropDropdown.selectedIndex].text;
        updatePestDropdown(initialCropText);

        document.getElementById('btn-step1').addEventListener('click', async () => {
            const selectedLocation = document.getElementById('location-select').value;
            const [latitude, longitude] = selectedLocation.split(',');

            commonParams.latitude = parseFloat(latitude).toFixed(4);
            commonParams.longitude = parseFloat(longitude).toFixed(4);

            const date = document.getElementById('weather-date').value.replace(/-/g, '');
            const beginTime = document.getElementById('begin-time').value.replace(':', '') + '00';
            const untilTime = document.getElementById('until-time').value.replace(':', '') + '00';
            const url = `${BASE_URL}/weather/hrly?apiKey=${API_KEY}&latitude=${commonParams.latitude}&longitude=${commonParams.longitude}&begin=${date}${beginTime}&until=${date}${untilTime}`;
            try {
                hourlyData = await fetchData(url);
                renderChart('result-step1', 'hourlyChart', 'hrly-chart-options', hourlyData);
                document.getElementById('chart-options-step1').classList.remove('hidden');
                document.getElementById('excel-step1').disabled = false;
                document.getElementById('step-2').classList.remove('hidden');
            } catch (error) { document.getElementById('result-step1').innerText = '데이터 조회 실패: ' + error.message; }
        });
        document.getElementById('chart-options-step1').addEventListener('change', () => renderChart('result-step1', 'hourlyChart', 'hrly-chart-options', hourlyData));
        document.getElementById('excel-step1').addEventListener('click', () => downloadExcel(hourlyData, 'hourly_weather.xlsx', nameMappings.weather));

        document.getElementById('btn-step2').addEventListener('click', async () => {
            const begin = document.getElementById('begin-date-daily').value.replace(/-/g, '');
            const until = document.getElementById('until-date-daily').value.replace(/-/g, '');
            const url = `${BASE_URL}/weather/daly?apiKey=${API_KEY}&latitude=${commonParams.latitude}&longitude=${commonParams.longitude}&begin=${begin}&until=${until}`;
            const accumulatedTempEl = document.getElementById('accumulated-temp');
            accumulatedTempEl.textContent = '적산온도: 계산중...';
            try {
                dailyData = await fetchData(url);
                const accumulatedTemp = dailyData.reduce((sum, day) => {
                    const temp = parseFloat(day.avgTp);
                    return temp >= 10 ? sum + temp : sum;
                }, 0);
                accumulatedTempEl.textContent = `적산온도: ${accumulatedTemp.toFixed(1)} °C`;
                renderChart('result-step2', 'dailyChart', 'daly-chart-options', dailyData);
                document.getElementById('chart-options-step2').classList.remove('hidden');
                document.getElementById('excel-step2').disabled = false;
                document.getElementById('step-3').classList.remove('hidden');
            } catch (error) {
                document.getElementById('result-step2').innerText = '데이터 조회 실패: ' + error.message;
                accumulatedTempEl.textContent = '적산온도: 계산 실패';
            }
        });
        document.getElementById('chart-options-step2').addEventListener('change', () => renderChart('result-step2', 'dailyChart', 'daly-chart-options', dailyData));
        document.getElementById('excel-step2').addEventListener('click', () => downloadExcel(dailyData, 'daily_weather.xlsx', nameMappings.weather));

        document.getElementById('btn-step3').addEventListener('click', async () => {
            commonParams.kidofcomdtyId = document.getElementById('kidofcomdtyId').value;
            const beginDate = document.getElementById('begin-date-pest').value.replace(/-/g, '');
            const untilDate = document.getElementById('until-date-pest').value.replace(/-/g, '');
            const url = `${BASE_URL}/dip/riskStepOttc?apiKey=${API_KEY}&latitude=${commonParams.latitude}&longitude=${commonParams.longitude}&kidofcomdtyId=${commonParams.kidofcomdtyId}&begin=${beginDate}&until=${untilDate}`;
            try {
                pestRiskData = await fetchData(url);
                const headers = Object.keys(nameMappings.pestRisk).map(key => ({ title: nameMappings.pestRisk[key], key: key }));
                renderTable('result-step3', headers, pestRiskData);
                document.getElementById('excel-step3').disabled = false;
                document.getElementById('step-4').classList.remove('hidden');
            } catch (error) {
                document.getElementById('result-step3').innerText = '데이터 조회 실패: ' + error.message;
            }
        });
        document.getElementById('excel-step3').addEventListener('click', () => downloadExcel(pestRiskData, 'pest_risk.xlsx', nameMappings.pestRisk));

        document.getElementById('btn-step4').addEventListener('click', async () => {
            commonParams.dipCd = document.getElementById('dipCd').value;
            commonParams.sprayYmd = document.getElementById('spray-date').value.replace(/-/g, '');
            const pestiBrandName = document.getElementById('agchm-select').value;
            const url = `${BASE_URL}/agchm?apiKey=${API_KEY}&latitude=${commonParams.latitude}&longitude=${commonParams.longitude}&dipCd=${commonParams.dipCd}&sprayYmd=${commonParams.sprayYmd}&pestiBrandName=${encodeURIComponent(pestiBrandName)}`;

            try {
                const responseData = await fetchData(url);
                const resultBox = document.getElementById('result-step4');
                let dataObject = responseData && Array.isArray(responseData) ? responseData[0] : responseData;

                if (dataObject && typeof dataObject === 'object') {
                    rcmdPesticideData = dataObject;
                    resultBox.innerHTML = `
                        <p><strong>농약살포지수:</strong> <span class="spray-index">${rcmdPesticideData.agchmSprayIdex || 'N/A'}</span></p>
                        <div id="rcmd-table-container"></div>
                    `;

                    if (rcmdPesticideData.agchmSprayRcmdtnList && Array.isArray(rcmdPesticideData.agchmSprayRcmdtnList)) {
                        const headers = Object.keys(nameMappings.rcmdPesticide).map(key => ({ title: nameMappings.rcmdPesticide[key], key: key }));
                        renderTable('rcmd-table-container', headers, rcmdPesticideData.agchmSprayRcmdtnList);
                        document.getElementById('excel-step4').disabled = false;
                        document.getElementById('excel-step4').style.display = 'block';
                    } else {
                        document.getElementById('rcmd-table-container').innerHTML = "<p>추천된 농약 목록이 없습니다.</p>";
                        document.getElementById('excel-step4').disabled = true;
                    }
                    document.getElementById('step-5').classList.remove('hidden');
                } else {
                    resultBox.innerHTML = '<p>추천 농약 정보를 불러올 수 없습니다.</p>';
                    rcmdPesticideData = {};
                }
            } catch (error) {
                document.getElementById('result-step4').innerText = '데이터 조회 실패: ' + error.message;
            }
        });

        document.getElementById('excel-step4').addEventListener('click', () => {
            if (rcmdPesticideData && rcmdPesticideData.agchmSprayRcmdtnList) {
                downloadExcel(rcmdPesticideData.agchmSprayRcmdtnList, 'recommended_pesticide.xlsx', nameMappings.rcmdPesticide)
            } else {
                alert('다운로드할 추천 농약 목록이 없습니다.');
            }
        });

        // ★★★ 단계 5: 상세 처방전 조회 (수정된 부분) ★★★
        document.getElementById('btn-step5').addEventListener('click', async () => {
            commonParams.agchmNm = document.getElementById('agchm-select').value;
            const url = `${BASE_URL}/adwTotal?apiKey=${API_KEY}&latitude=${commonParams.latitude}&longitude=${commonParams.longitude}&dipCd=${commonParams.dipCd}&sprayYmd=${commonParams.sprayYmd}&pestiBrandName=${encodeURIComponent(commonParams.agchmNm)}`;
            try {
                const responseData = await fetchData(url);
                const resultBox = document.getElementById('result-step5');

                // API 응답이 배열 또는 객체일 경우 모두 처리
                let dataObject = null;
                if (Array.isArray(responseData) && responseData.length > 0) {
                    dataObject = responseData[0];
                } else if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
                    dataObject = responseData;
                }

                if (dataObject) {
                    prscPesticideData = dataObject;
                    // 새로운 응답 구조에 맞춰 HTML 생성
                    resultBox.innerHTML = `<div class="prescription-card"><p>${prscPesticideData.prscCn.replace(/\n/g, '<br>')}</p></div>`;
                    document.getElementById('excel-step5').disabled = false;
                } else {
                    resultBox.innerHTML = '<p>조회된 처방 내용이 없습니다.</p>';
                    prscPesticideData = {};
                }
            } catch (error) {
                resultBox.innerText = '데이터 조회 실패: ' + error.message;
            }
        });

        document.getElementById('excel-step5').addEventListener('click', () => {
            if (prscPesticideData && prscPesticideData.prscCn) {
                downloadExcel(prscPesticideData, 'pesticide_prescription.xlsx', nameMappings.prscPesticide);
            } else {
                alert('다운로드할 처방전 데이터가 없습니다.');
            }
        });
    }

    // 앱 초기화 함수를 호출하여 전체 프로세스 시작
    initializeApp();
});