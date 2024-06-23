import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Image,
  TouchableOpacity,
  useWindowDimensions
} from "react-native";
import { TabBar, TabView, SceneMap } from 'react-native-tab-view';
import TcpSocket from 'react-native-tcp-socket';
import * as Animatable from 'react-native-animatable';
import { AnimatedCircularProgress } from 'react-native-circular-progress'; 
import {
  LineChart,
} from "react-native-chart-kit";
import Voice from '@react-native-voice/voice';

const port = 10004; // TCP/IP 통신에 사용할 포트 번호

export default function App() {

  /* 화면 */
  const layout = useWindowDimensions(); // 현재 창의 치수를 가져옴
  const [index, setIndex] = useState(0); // TabView의 현재 인덱스 상태
  const [routes] = useState([
    { key: 'heartBeat', title: '심박수' },
    { key: 'tempAndHumi', title: '온습도' },
    { key: 'ruler', title: '거리측정' },
  ]); // TabView의 라우트 설정

  /* 차트 라벨 */
  const label = ["C7", "C6", "C5", "C4", "C3", "C2", "C1"]; // BPM 라벨

  /* 심박수 */
  const [heartRate, setHeartRate] = useState(0); // 현재 심박수 상태
  const [heartRateArr, setHeartRateArr] = useState([0, 0, 0, 0, 0, 0, 0]); // BPM 데이터 배열
  
  /* 온습도 */
  const [temperature, setTemperature] = useState(0); // 현재 온도 상태
  const [humidity, setHumidity] = useState(0); // 현재 습도 상태
  const maxTemperature = 40; // 최대 온도 설정
  const [temperatureArr, setTemperatureArr] = useState([0, 0, 0, 0, 0, 0, 0]); // 온도 데이터 배열
  const [humidityArr, setHumidityArr] = useState([0, 0, 0, 0, 0, 0, 0]); // 습도 데이터 배열
  
  /* 거리 */
  const [distance, setDistance] = useState(0); // 현재 거리 상태

  /* tcp/ip */
  const [ipAddress, setIpAddress] = useState(''); // IP 주소 상태
  const [client, setClient] = useState(null); // TCP/IP 클라이언트 상태
  const [isConnected, setIsConnected] = useState(false); // 서버 연결 상태
  const [message, setMessage] = useState(''); // 송신할 메시지 상태

  /* 음성 인식 */
  const [isRecording, setIsRecording] = useState(false); // 음성 녹음 상태

  const heartRateArrRef = useRef(heartRateArr); // 심박수 배열의 참조
  const temperatureArrRef = useRef(temperatureArr); // 온도 배열의 참조
  const humidityArrRef = useRef(humidityArr); // 습도 배열의 참조

  // heartRateArr 상태가 변경될 때마다 heartRateArrRef를 업데이트
  useEffect(() => {
    heartRateArrRef.current = heartRateArr;
  }, [heartRateArr]);

  // temperatureArr 상태가 변경될 때마다 temperatureArrRef를 업데이트
  useEffect(() => {
    temperatureArrRef.current = temperatureArr;
  }, [temperatureArr]);

  // humidityArr 상태가 변경될 때마다 humidityArrRef를 업데이트
  useEffect(() => {
    humidityArrRef.current = humidityArr;
  }, [humidityArr]);

  // 음성 인식 시작 함수
  const handleVoiceStart = async () => {
    try {
      await Voice.start('ko-KR'); // 한국어 음성 인식 시작
      setIsRecording(true); // 녹음 상태를 true로 설정
    } catch (e) {
      console.error(e);
    }
  };

  // 음성 인식 종료 함수
  const handleVoiceStop = async () => {
    try {
      await Voice.stop(); // 음성 인식 중지
      setIsRecording(false); // 녹음 상태를 false로 설정
    } catch (e) {
      console.error(e);
    }
  };

  // 공백 제거 함수
  const removeSpaces = (text) => {
    return text.replace(/\s+/g, '');
  };

  // 음성 인식 결과 이벤트 리스너 설정 및 제거
  useEffect(() => {
    Voice.onSpeechResults = handleVoiceResults;
    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  // 음성 인식 결과 처리 함수
  const handleVoiceResults = (event) => {
    if (event.value && event.value.length > 0) {
      let voiceMsg = removeSpaces(event.value[0]);
      
      console.log("음성인식 : " + voiceMsg);
  
      switch(voiceMsg){
        case '심박수':
          console.log(heartRateArrRef.current);
          const heartSum = heartRateArrRef.current.reduce((acc, curr) => acc + curr, 0);
          const heartAvg = (heartSum / heartRateArrRef.current.length).toFixed(2);
          voiceMsg = `HEART : ${heartAvg}`;
          break;
        case '온습도':
          console.log(temperatureArrRef.current);
          console.log(humidityArrRef.current);
          const tempSum = temperatureArrRef.current.reduce((acc, curr) => acc + curr, 0);
          const humiSum = humidityArrRef.current.reduce((acc, curr) => acc + curr, 0);
          
          const tempAvg = (tempSum / temperatureArrRef.current.length).toFixed(2);
          const humiAvg = (humiSum / humidityArrRef.current.length).toFixed(2);
          
          voiceMsg = `${tempAvg}C, ${humiAvg}%`;
          break;
        case '거리측정':
          voiceMsg = "LENGTH";
          break;
        default:
          voiceMsg = "";
          break;
      }
  
      console.log("변환데이터 : " + voiceMsg);
      setMessage(voiceMsg);
 
      handleVoiceStop();
      handleSendData();
    }
  };  
  
  // 줄바꿈 제거 함수
  const removeLineBreaks = (text) => {
    return text.replace(/(\r\n|\n|\r)/gm, "");
  };

  // 서버에 연결하는 함수
  const handleConnect = () => {
    const options = {
      port: port,
      host: ipAddress,
      reuseAddress: true,
    };

    console.log(`Connecting to ${options.host}:${options.port}`);
    
    // Create socket
    const newClient = TcpSocket.createConnection(options, () => {
      console.log('Connected to server');
      setIsConnected(true); // Update connection status
      setClient(newClient); // Update client state
    });

    // 데이터 수신 이벤트 리스너
    newClient.on('data', function(data) {
      // Assuming the data received is in the format "temperature,humidity"
      const dataArr = removeLineBreaks(data.toString()).split(',');
      console.log(dataArr);
      if(dataArr[0] === 'ALL'){
        const tmp = parseInt(dataArr[1]);
        const temp = parseFloat(dataArr[2]);
        const hum = parseFloat(dataArr[3]);

        // 업데이트된 heartRateArr 배열 생성
        setHeartRateArr((prevArray) => {
          let newArray = [...prevArray];
          if (newArray.length >= 7) {
            newArray.shift(); // 배열 길이가 7 이상이면 첫 번째 요소 제거
          }
          newArray.push(tmp); // 새로운 요소 추가
          return newArray;
        });

        setTemperatureArr((prevArray) => {
          let newArray = [...prevArray];
          if (newArray.length >= 7) {
            newArray.shift(); // 배열 길이가 7 이상이면 첫 번째 요소 제거
          }
          newArray.push(temp); // 새로운 요소 추가
        
          return newArray;
        });
        
        setHumidityArr((prevArray) => {
          let newArray = [...prevArray];
          if (newArray.length >= 7) {
            newArray.shift(); // 배열 길이가 7 이상이면 첫 번째 요소 제거
          }
          newArray.push(hum); // 새로운 요소 추가
          return newArray;
        });        

        setHeartRate(tmp);
        setTemperature(temp);
        setHumidity(hum);
      } else if(dataArr[0] === 'LENGTH'){
        const length = dataArr[1];
        setDistance(length);
      }
    });

    // 연결 에러 이벤트 리스너
    newClient.on('error', function(error) {
      console.log('Connection error:', error);
      setIsConnected(false); // Update connection status
    });

    // 연결 종료 이벤트 리스너
    newClient.on('close', function(){
      console.log('Connection closed!');
      setTemperature(null);
      setHumidity(null);
      setIsConnected(false); // Update connection status
    });
  };

  // 클라이언트, 연결 상태, 메시지 상태가 변경될 때마다 데이터를 전송
  useEffect(() => {
    if (client != null && isConnected == true && message !== '') {
      handleSendData();
    }
  }, [client, isConnected, message]);

  // 데이터를 전송하는 함수
  const handleSendData = () => {
    if (message === '') return;

    if (client && isConnected) {
      const messageWithNewline = message + '\n'; // 메시지에 줄바꿈 문자를 추가합니다.
      client.write(messageWithNewline);
      console.log(`Sent: ${messageWithNewline}`);
      setMessage(''); // 메시지를 보낸 후 입력을 지웁니다.
    } else {
      console.log('Client not connected or message is empty');
    }
  };
  
  // 컴포넌트 언마운트 시 클라이언트 정리
  useEffect(() => {
    return () => {
      if (client) {
        client.destroy();
      }
    };
  }, [client]);

  // 음성 버튼 렌더링 함수
  const renderVoiceButton = () => {
    if (isRecording) {
      return (
        <View style={styles.voiceButtonContainer}>
          <TouchableOpacity style={styles.voiceButton} onPress={handleVoiceStop}>
            <Text style={styles.buttonText}>STOP</Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      return (
        <View style={styles.voiceButtonContainer}>
          <TouchableOpacity onPress={handleVoiceStart}>
            <Image
              source={require('./src/images/ico_mic.png')}
              style={styles.rulerImage}
            /> 
          </TouchableOpacity>
        </View>
      );
    }
  };

  // 심박수 화면 렌더링 함수
  const HeartBeatRoute = () => (
    <View style={styles.container}>
      <Animatable.Image
        animation="pulse"
        iterationCount="infinite"  
        source={require('./src/images/heartbeat.png')} 
      />
      <Text style={styles.mainText}>Heart Rate</Text>
      <View style={styles.heartRateWrap}>
        <Text style={styles.heartRate}>{heartRate}</Text>
      </View>

      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}> BPM Chart</Text>
        <LineChart
          data={{
            labels: label,
            datasets: [
              {
                data: heartRateArr
              }
            ]
          }}
          width={layout.width - 20} // from react-native
          height={220}
          yAxisSuffix="bpm"
          yAxisInterval={1} // optional, defaults to 1
          chartConfig={{
            backgroundColor: "red",
            backgroundGradientFrom: "red",
            backgroundGradientTo: "#ffa726",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: "6",
              strokeWidth: "2",
              stroke: "#ffa726"
            }
          }}
          bezier
          style={{
            marginVertical: 8,
            borderRadius: 16,
          }}
        />
      </View>    
      {renderVoiceButton()}
    </View>
  );
  
  // 온습도 화면 렌더링 함수
  const TempAndHumiRoute = () => (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        <AnimatedCircularProgress
          size={170}
          width={20}
          fill={(temperature !== null ? (temperature / maxTemperature) * 100 : 0)}
          tintColor="#ff6347"
          backgroundColor="#e0e0e0"
          rotation={0}
          lineCap="round"
        >
          {
            (fill) => (
              <Text style={styles.progressText}>
                {`${Math.round((fill / 100) * maxTemperature)}°C`}
              </Text>
            )
          }
        </AnimatedCircularProgress>
  
        <AnimatedCircularProgress
          size={170}
          width={20}
          fill={(humidity !== null ? humidity : 0)}
          tintColor="#1e90ff"
          backgroundColor="#e0e0e0"
          rotation={0}
          lineCap="round"
        >
          {
            (fill) => (
              <Text style={styles.progressText}>
                {`${Math.round(fill)}%`}
              </Text>
            )
          }
        </AnimatedCircularProgress>
      </View>
  
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}> Temp&Humi Chart</Text>
        <LineChart
          data={{
            labels: label,
            datasets: [
              {
                data: temperatureArr,
                color: (opacity = 1) => `red`, // optional
                strokeWidth: 2, // optional
              },
              {
                data: humidityArr,
                color: (opacity = 1) => `blue`, // optional
                strokeWidth: 2, // optional
              }
            ]
          }}
          width={layout.width - 20} // from react-native
          height={220}
          yAxisSuffix="%/°C"
          yAxisInterval={1} // optional, defaults to 1
          chartConfig={{
            backgroundGradientFrom: "red",
            backgroundGradientTo: "blue",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: "6",
              strokeWidth: "2",
              stroke: "#ffa726"
            }
          }}
          bezier
          style={{
            marginVertical: 8,
            borderRadius: 16,
          }}
        />
      </View>
      {renderVoiceButton()}
    </View>
  );  

  // 거리 측정 화면 렌더링 함수
  const RulerRoute = () => (
    <View style={styles.container}>
      <Image
        source={require('./src/images/ruler.png')} 
        style={styles.rulerImage}
      />

      {!distance ? (
        <Text style={styles.message}>현재 미측정</Text>
      ) : (
        <Text style={styles.distance}>{distance} CM</Text>
      )}
      {renderVoiceButton()}
    </View>
  );
  
  // TabView의 각 화면 설정
  const renderScene = SceneMap({
    heartBeat: HeartBeatRoute,
    tempAndHumi: TempAndHumiRoute,
    ruler: RulerRoute
  });

  // TabBar 렌더링 함수
  const renderTabBar = props => (
    <TabBar
      {...props}
      indicatorStyle={{ backgroundColor: 'white' }}
      style={{ backgroundColor: '#5c4b4b' }}
    />
  );

  return (
    <>
      {!isConnected ? (
        <View style={styles.container}>
          <Text style={styles.title}>Connect to Server</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter IP Address"
            value={ipAddress}
            onChangeText={setIpAddress}
          />
          <TouchableOpacity style={styles.button} onPress={handleConnect}>
            <Text style={styles.buttonText}>Connect</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={{ width: layout.width }}
          renderTabBar={renderTabBar}
        />
      )}
    </>
  );  
}

const styles = StyleSheet.create({
  // 스타일 정의
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
    width: '80%',
  },
  button: {
    backgroundColor: '#007BFF',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  mainText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  heartRateWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartRate: {
    fontSize: 48,
    color: 'red',
    fontWeight: 'bold',
  },
  chartContainer: {
    marginVertical: 20,
  },
  chartTitle: {
    fontSize: 18,
    marginBottom: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  progressText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  rulerImage: {
    width: 150,
    height: 150,
  },
  voiceButtonContainer: {
    marginTop: 20,
  },
  voiceButton: {
    backgroundColor: '#007BFF',
    padding: 10,
    borderRadius: 5,
  },
  message: {
    fontSize: 18,
    color: 'gray',
  },
  distance: {
    fontSize: 48,
    fontWeight: 'bold',
  },
});
