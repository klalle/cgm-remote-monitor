import './App.css';

import axios from 'axios';

import 'chartjs-adapter-moment';

import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import {
  TimeScale, //Import timescale instead of CategoryScale for X axis
  //CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  // BarElement,
  ScatterController,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Chart as ChartJS } from 'chart.js';
import { Line, Chart } from 'react-chartjs-2';
import React, { useState, useEffect, useRef } from 'react';
import ReactTooltip from 'react-tooltip';
import { NavLink } from 'react-router-dom';
import { slice } from 'lodash';
//import { svg } from 'd3-fetch';
import { TimeCounter } from './TimeCounter';

ChartJS.register(
  zoomPlugin,
  annotationPlugin,

  TimeScale, //Import timescale instead of CategoryScale for X axis
  //CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  // BarElement,
  ScatterController,
  Title,
  Tooltip,
  Legend,
  Filler
)

//TODO
//target som en range
//datasets group basals
function App() {

  // const variableLineColor = {
  //   id: "variableLineColor",
  //   afterDraw: (chart, args, options) => {
  //     setMiddleX((chart.scales['x']._userMax-chart.scales['x']._userMin)/2+chart.scales['x']._userMin);
  //   }
  // };

  // ChartJS.register(variableLineColor);

  const [chartData, setChartData] = useState({ datasets: [] });
  const chartRef = useRef();
  //const [chartOptions, setChartOptions] = useState({});
  const sgv = useRef();
  const openaps = useRef();
  const [currOpenaps, setCurrOpenaps] = useState({ suggested: { predBGs: { COB: [] } } });
  const tempBasal = useRef();
  const mealBolus = useRef();
  const profile = useRef();
  const updateInProgress = useRef(false);
  const ahead = useRef(true);
  const lastFetch = useRef(new Date().setTime(new Date().getTime() - 1000 * 3600 * 12));
  // const [havePanned, setHavePanned] = useState();
  const hasStarted = useRef(false);
  const currBGLinePos = useRef(0);
  const currWidth = useRef(1000 * 3600 * 12);
  const [currInfo, setCurrInfo] = useState();
  const [chkSmb, setChkSmb] = useState(false);
  const [chkBolus, setChkBolus] = useState(true);
  const [chkCharbs, setChkCarbs] = useState(true);
  const settings = useRef({
    displayUnits: 'mmol',
    bgTargTop: 10,
    bgTargBot: 3.5,
  });
  const unitConverter = useRef(18);

  const viewingHistory = useRef(false);

  // var localserver = "/kitescout";
  //if (process.env.REACT_APP_LOCALSERVER) localserver = "http://localhost:1338";
  const urlPath = window.location.pathname.split("/").filter(e => e);

  var localserver = urlPath.length == 0 ? "" : "/" + urlPath[0];
  if (window.location.host == "localhost:3000") {
    localserver = "http://localhost:1338";
  }
  useEffect(async () => {
    hasStarted.current = true;
    await getSettings();
    await getData(lastFetch.current);
    setPredLines();
    const interval = setInterval(async () => {
      if (!viewingHistory.current) {
        console.log('Fetching new data...');
        await getData(lastFetch.current); //only fetch newest data
        //setUpdStatus(new Date());
        setPredLines();
      } else {
        console.log("Pan current time into view to get newest data.");
      }
    }, 1000 * 30);
    return () => clearInterval(interval);
  }, []);



  const getSettings = async () => {
    const ret = await axios.get(localserver + "/getsettings");
    settings.current = ret.data;
    console.log("settings:")
    console.log(settings.current);
    if (!settings.current?.displayUnits?.includes("mmol")) {
      unitConverter.current = 1;
    }
    settings.current.bgTargTop = settings.current.bgTargTop ? Number(settings.current.bgTargTop) / unitConverter.current : 180 / Number(settings.current.bgTargTop);
    settings.current.bgTargBot = settings.current.bgTargBot ? Number(settings.current.bgTargBot) / unitConverter.current : 80 / Number(settings.current.bgTargBot);
  }
  const getData = async (fromDate, toDate = new Date(), prune = false) => {
    let start = new Date();

    updateInProgress.current = true;
    try {

      fromDate = new Date(fromDate).toISOString();
      toDate = toDate.toISOString();
      console.log("hämtar alla promices: ")
      // let sgvRes = await axios.get(localserver + "/getsgv", { params: { datefrom: fromDate, dateto: toDate, count: 10000 } });
      // let openapsRes = await axios.get(localserver + "/getopenaps", { params: { datefrom: fromDate, dateto: toDate, count: 10000 } });
      // let profileRes = await axios.get(localserver + "/getprofiles", { params: { datefrom: fromDate, dateto: toDate, count: 10000 } });
      // let basalRes = await axios.get(localserver + "/gettempbasal", { params: { datefrom: fromDate, dateto: toDate, count: 10000 } });
      // let mealbolusRes = await axios.get(localserver + "/getmealbolus", { params: { datefrom: fromDate, dateto: toDate, count: 10000 } });

      //testar om den klarar uppdelat i 2 svängar... (max 3 åt gången, inte 5...)
      const [sgvRes, openapsRes] = await Promise.all([
        axios.get(localserver + "/getsgv", { params: { datefrom: fromDate, dateto: toDate, count: 10000 } }),
        axios.get(localserver + "/getopenaps", { params: { datefrom: fromDate, dateto: toDate, count: 10000 } })
      ]);
      const [profileRes, basalRes, mealbolusRes] = await Promise.all([
        axios.get(localserver + "/getprofiles", { params: { datefrom: fromDate, dateto: toDate, count: 10000 } }),
        axios.get(localserver + "/gettempbasal", { params: { datefrom: fromDate, dateto: toDate, count: 10000 } }),
        axios.get(localserver + "/getmealbolus", { params: { datefrom: fromDate, dateto: toDate, count: 10000 } })
      ]);

      //ns verkar inte klara för många frågor samtidigt...
      // const [sgvRes, openapsRes, profileRes, basalRes, mealbolusRes] = await Promise.all([
      //   axios.get(localserver + "/getsgv", { params: { datefrom: fromDate, dateto: toDate, count: 10000 } }),
      //   axios.get(localserver + "/getopenaps", { params: { datefrom: fromDate, dateto: toDate, count: 10000 } }),
      //   axios.get(localserver + "/getprofiles", { params: { datefrom: fromDate, dateto: toDate, count: 10000 } }),
      //   axios.get(localserver + "/gettempbasal", { params: { datefrom: fromDate, dateto: toDate, count: 10000 } }),
      //   axios.get(localserver + "/getmealbolus", { params: { datefrom: fromDate, dateto: toDate, count: 10000 } }),
      // ]);

      let s = sgvRes.data.map(s => (({ created_at, sgv }) => ({ x: created_at, bg: sgv / unitConverter.current }))(s));

      let oa = openapsRes.data.map(s => (({ created_at, configuration, openaps }) => ({
        x: created_at, configuration: configuration, openaps: openaps
      }))(s)).filter(x => x.openaps);

      let p = profileRes.data.map(s => (({ created_at, duration, profile, profileJson }) => ({
        x: created_at, duration: duration, profileName: profile, profileJson: JSON.parse(profileJson)
      }))(s));


      let m = mealbolusRes.data.map(s => (({ created_at, insulin, carbs }) => ({
        x: created_at, insulin: insulin, carbs: carbs
      }))(s));


      let b = basalRes.data.map(s => (({ created_at, durationInMilliseconds, rate }) => ({
        x: created_at, duration: durationInMilliseconds, basal: rate
      }))(s));


      //console.log("Found: \n" + s.length + " BG\n" + oa.length + " openaps treatments");

      var added = 0;

      function addToAndSort(source, add) {
        if (add.length == 0) return source;
        //if (!reverse) {
        let last = source[0];
        if (last.x != add[0].x) {
          var firstNewIndex = add.findIndex((it) => it.x == last.x);
          if (firstNewIndex == -1) {
            source = add.concat(source);
            firstNewIndex = add.length;
          } else {
            source = add.slice(0, firstNewIndex).concat(source);
          }
          console.log("added: " + firstNewIndex);
          added += firstNewIndex;
        }
        // } else {
        //   source = source.concat(add);
        //   added += add.length;
        // }
        return source;
      }

      if (sgv.current && !prune) {
        sgv.current = addToAndSort(sgv.current, s)
      } else {
        added += s.length;
        sgv.current = s;
      }

      if (openaps.current && !prune) {
        openaps.current = addToAndSort(openaps.current, oa)
      } else {
        added += oa.length;
        openaps.current = oa;
      }

      if (tempBasal.current && !prune) {
        tempBasal.current = addToAndSort(tempBasal.current, b);
        // b = b.concat(tempBasal.current);
        // b = b.filter((item, pos) => b.findIndex(it => it.x == item.x) == pos); //remove douplicates
        // b = b.sort((a, b) => new Date(a.x) < new Date(b.x) ? 1 : -1);
      } else {
        added += b.length;
        tempBasal.current = b;
      }

      if (profile.current && !prune) {
        profile.current = addToAndSort(profile.current, p);
        // p = p.concat(profile.current);
        // p = p.filter((item, pos) => p.findIndex(it => it.x == item.x) == pos); //remove douplicates
        // p = p.sort((a, b) => new Date(a.x) < new Date(b.x) ? 1 : -1);
      } else {
        added += p.length;
        profile.current = p;
      }

      if (mealBolus.current && !prune) {
        mealBolus.current = addToAndSort(mealBolus.current, m);
        // m = m.concat(mealBolus.current);
        // m = m.filter((item, pos) => m.findIndex(it => it.x == item.x) == pos); //remove douplicates
        // m = m.sort((a, b) => new Date(a.x) < new Date(b.x) ? 1 : -1);
      } else {
        added += m.length;
        mealBolus.current = m;
      }

      if (added == 0) {
        console.log("Nothing new!");
        // console.log("From: " + fromDate);
        // console.log("To: " + toDate);
        updateInProgress.current = false;
        return;
      } else if (s.length > 0 && oa.length > 0) {
        lastFetch.current = toDate;//new Date(new Date(toDate).getTime() - 1000 * 60 * 10).getTime(); //get 10min back (strangely it misses openaps if not...)
      }

    } catch (e) {
      console.log("Could not get data from server...")
      console.log(e);
    }
    console.log("getdata: " + (new Date() - start) + "ms")
    //chartRef.current.stop();// make sure animations are not running
    setData();
    setInfoData(chartRef.current);
    //chartRef.current.update('none');

  };

  const RGB_red = 'rgb(255,0,0)';
  const RGB_reda = 'rgba(255,0,0,0.2)';
  const RGB_orange = 'rgb(255,127,0)';
  const RGB_orangea = 'rgba(255,127,0,0.15)';
  const RGB_blue = 'rgb(0, 100, 255)';
  const RGB_bluea = 'rgba(0, 100, 255, 0.15)';
  const RGB_green = 'rgb(75,255,0)';
  const RGB_greena = 'rgba(75, 255, 0, 0.15)';
  const RGB_gray = 'rgb(128,128,128)';
  const RGB_graya = 'rgba(128,128,128,0.15)';
  const RGB_transp = 'rgba(0,0,0,0)';
  let bg = [];
  let iob = [];
  let cr = [];
  let targ = [];
  let cob = [];
  let sens = [];
  let smb = [];
  let mealInsu = [];
  let reason = [];
  let pred = [];
  const getHpart = (t) => t.split(":")[0];
  const getMpart = (t) => t.split(":")[1];

  function returnDateWithHHMM(date, timeStrHHMM) {
    return new Date(date)
      .setHours(getHpart(timeStrHHMM), getMpart(timeStrHHMM), 0, 0);
  }

  function setData() {
    bg = [];
    iob = [];
    cob = [];
    cr = [];
    targ = [];
    sens = [];
    smb = [];
    mealInsu = [];
    reason = [];
    let start = new Date();
    if ((!sgv.current || sgv.current.length == 0) && (!openaps.current || openaps.current.length == 0)) {
      alert("No data to show... try scrolling back in time or check your MONGODB_URI in Heroku!")
      return;
    };
    sgv.current.forEach((e, index) => {
      //if (index < 500) {
      bg.push([
        new Date(e.x),
        e.bg
      ])
      // }
    });
    let firstBGtime = bg[bg.length - 1][0].getTime();
    let lastBGtime = bg[0][0].getTime();

    mealBolus?.current.forEach((e, index) => {
      //if (index < 500) {
      mealInsu.push({
        x: new Date(e.x),
        insulin: e.insulin,
        carbs: e.carbs,
      })
      // }
    });
    var COBExists = false;
    var lastSens = null;
    openaps.current.forEach((e, index) => {
      if (e.openaps.iob) {
        iob.push({
          x: new Date(e.x),
          y: e.openaps.iob.iob,
          act: e.openaps.iob.activity
        });
      }


      if (e.openaps.suggested) {
        let sug = e.openaps.suggested;
        if (sug.units) {
          smb.push({
            x: new Date(e.x),
            y: sug.bg / unitConverter.current - (19 - unitConverter.current),
            bolus: sug.units
          });
        }
        reason.push([
          new Date(e.x),
          sug.reason
        ]);

        if (sug.COB) {
          if (!COBExists) {
            COBExists = true;
            cob.push([
              new Date(e.x),
              0
            ]);
          }
          cob.push([
            new Date(e.x),
            sug.COB / 10
          ])
        } else {
          COBExists = false;
          cob.push([
            new Date(e.x),
            0
          ]);
          cob.push([
            new Date(e.x),
            null
          ])
        }

        if (sug.sensitivityRatio) {
          if (sug.sensitivityRatio != lastSens) {
            sens.push([
              new Date(e.x),
              lastSens ? lastSens * 10 - 10 : 0
            ]);
            if (sug.sensitivityRatio == 1) {
              sens.push([
                new Date(e.x),
                0
              ]);
              sens.push([
                new Date(e.x),
                null
              ]);
              lastSens = null;
            } else {
              sens.push([
                new Date(e.x),
                sug.sensitivityRatio * 10 - 10
              ]);
              lastSens = sug.sensitivityRatio;
            }

          }
        }

      }
    });

    let basalProfile = [];
    let basalProfileFilled = [];
    let realProfiles = profile.current.filter(e => e.duration == 0);
    //realProfiles.reverse();
    var lastProfileStartTime = new Date(); //~lastBGtime
    var lastProfileStartVal = null;

    const datesAreOnSameDay = (first, second) =>
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate();



    var lastVal = null;
    realProfiles.forEach((e, index) => {
      var currTime = lastProfileStartTime;
      let eProfile = e.profileJson.basal.slice().reverse(); //reverses the array inplace as well if not slice=copy!
      let carbratio = e.profileJson.carbratio.slice().reverse();
      carbratio.forEach(r => {
        cr.push({
          profileStartTime: new Date(e.x),
          hour: r.time,
          value: r.value
        })
      })
      let targets = e.profileJson.target_low.slice().reverse();
      targets.forEach(r => {
        targ.push({
          profileStartTime: new Date(e.x),
          hour: r.time,
          value: r.value
        })
      })


      let startProfileDate = new Date(e.x);
      while (currTime >= startProfileDate) {
        eProfile.forEach((b) => {
          let bTime = returnDateWithHHMM(currTime, b.time);
          if (bTime >= startProfileDate
            && bTime < new Date().setTime(new Date().getTime() + 6 * 3600 * 1000) //start 6h before currtime
            && bTime > new Date().setTime(firstBGtime - 6 * 3600 * 1000)) {
            if (lastVal) {
              basalProfile.push([
                bTime,
                lastVal
              ])
            }
            basalProfile.push([
              bTime,
              b.value
            ])
            lastVal = b.value;
          }
        });
        currTime.setDate(currTime.getDate() - 1);
      }
    });
    var lastStart = 1000 * 3600;
    let tempBasProf = [];

    lastProfileStartTime = new Date(); //set to midnight today
    const tempProf = profile.current.filter(e => e.duration > 0);
    /*tempProf.forEach((e) => {
      let eProfile = e.profileJson.basal.reverse(); //reverses the array inplace as well!
      let durationms = e.duration * 60 * 1000;
      let startProfileTime = new Date(e.x).getTime();
      let endProfileTime = new Date(e.x).getTime() + durationms;
      var currTime = endProfileTime;

      lastVal = null;

      let firstbasalOffset = eProfile[eProfile.length - 1].timeAsSeconds * 1000;

      while (currTime >= startProfileTime) {
        eProfile.forEach((b, index) => {
          let bTime = returnDateWithHHMM(currTime, b.time); //create a time of b.time on same day as currTime
          var endTime = 0;;
          if (index == 0) { //last basal
            endTime = new Date(currTime).setHours(23, 59, 59, 999) + firstbasalOffset;
          }
          else {
            endTime = returnDateWithHHMM(currTime, eProfile[index - 1].time);
          }
          if (endTime > endProfileTime) {
            endTime = startProfileTime + durationms;
          }
          if (endTime > lastProfileStartTime) {
            endTime = lastProfileStartTime;
          }

          if (endTime < startProfileTime) {
            currTime = startProfileTime + 1; //force while loop to quit
            return;
          }
          if (bTime < startProfileTime) {
            bTime = startProfileTime;
          }
          if (bTime < endProfileTime
            && bTime > new Date().setTime(firstBGtime - 5 * 3600 * 1000)) {


            if (!lastVal) {
              tempBasProf.push([
                endTime,
                0
              ]);
            }
            tempBasProf.push([
              endTime,
              b.value
            ]);

            tempBasProf.push([
              bTime,
              b.value
            ])
            tempBasProf.push([
              bTime,
              0
            ])
            tempBasProf.push([
              bTime,
              null
            ])

            lastVal = b.value;

          }
          currTime = bTime;
        });
        currTime = new Date(new Date().setDate(new Date(currTime).getDate() - 1)).setHours(23, 59, 59, 999);

      }
      lastProfileStartTime = startProfileTime;

    });*/




    let tempBasLoop = [];
    var lastStart = new Date().getTime() + 1000 * 3600 * 5;
    tempBasal?.current.forEach((e, index) => {
      let t = new Date(e.x).getTime();
      if (t > firstBGtime) {
        if (t + e.duration > lastStart) {
          e.duration = lastStart - t;
        }
        tempBasLoop.push([
          t + e.duration,
          null
        ]);
        tempBasLoop.push([
          t + e.duration,
          0
        ]);
        tempBasLoop.push([
          t + e.duration,
          e.basal
        ]);
        tempBasLoop.push([
          t,
          e.basal
        ]);
        tempBasLoop.push([
          t,
          0
        ]);

        tempBasLoop.push([
          t,
          null
        ]);
        lastStart = t;
      }
    });


    // if (basalProfile[0][0] > tempBasLoop[0][0]) {
    //   basalProfileFilled.push([
    //     basalProfile[0][0],
    //     basalProfile[0][1]
    //   ]);
    //   basalProfileFilled.push([
    //     tempBasLoop[0][0],
    //     basalProfile[0][1]
    //   ]);
    // }
    const findBasalAt = (t) => {
      for (let i = 0; i < basalProfile.length; i++) {
        if (t >= basalProfile[i][0]) {
          return basalProfile[i][1];
        }
      }
      return basalProfile[0][1];
    }
    var lastTime = new Date().getTime();
    var lastVal = null;
    tempBasLoop.forEach((tp) => {
      if (tp[1] == null && lastVal == null && lastTime - tp[0] > 1000) {
        basalProfileFilled.push([
          lastTime,
          null
        ]);
        basalProfileFilled.push([
          lastTime,
          findBasalAt(lastTime)
        ]);


        basalProfileFilled.push([
          tp[0],
          findBasalAt(tp[0])
        ]);
        basalProfileFilled.push([
          tp[0],
          null
        ]);
      }
      lastTime = tp[0];
      lastVal = tp[1];
    });


    let width, height, gradient, yMax;
    function getGradient(chart, opacity) {
      const yScale = chart.scales['y'];
      const yPosHigh = yScale.getPixelForValue(Number(settings.current.bgTargTop));
      const yPosLow = yScale.getPixelForValue(Number(settings.current.bgTargBot));
      const { ctx, chartArea } = chart;

      const chartWidth = chartArea.right - chartArea.left;
      const chartHeight = chartArea.bottom - chartArea.top;
      const chartyMax = chart.scales.y.max;
      if (!gradient || width !== chartWidth || height !== chartHeight || chartyMax != yMax) {
        // if (!gradient || width !== chartWidth || height !== chartHeight) {

        // Create the gradient because this is either the first render
        // or the size of the chart has changed
        width = chartWidth;
        height = chartHeight;
        yMax = chartyMax;
        gradient = ctx.createLinearGradient(0, 0, 0, height);
        const red = 'rgba(255,0,0,' + opacity + ')';
        const green = 'rgba(0,255,0,' + opacity + ')';
        var highTH = yPosHigh / height
        if (highTH < 0) highTH = 0;
        var lowTH = yPosLow / height
        if (lowTH < 0) lowTH = 1;
        gradient.addColorStop(1, red);
        gradient.addColorStop(highTH, red);
        gradient.addColorStop(highTH, green);
        gradient.addColorStop(lowTH, green);
        gradient.addColorStop(lowTH, red);
        gradient.addColorStop(0, red);
      }

      return gradient;
    }
    function setBolusRadius(val) {
      if (smb.length > 0) {
        return smb[val.index].bolus * 10;
      } else {
        return 25;
      }
    }
    function setMealBolusRadius(val) {
      if (val.raw != undefined) {
        return val.raw[2] * 2;
      } else {
        return 0;
      }
    }
    function setMealCarbRadius(val) {
      if (val.raw != undefined) {
        return val.raw[2] / 5;
      } else {
        return 0;
      }
    }

    function setIobMinusCobInsu() {
      let c = cr;
      function findActiveCrForTimeAndDate(d) {
        //cr.filter(x => x.profileStartTime < d)
        return cr.find(function (p) {
          return p.profileStartTime < d && d > returnDateWithHHMM(d, p.hour);
        }).value
        //todo: sortera cr-listans profileStartTime och hitta den cr som matchar c[1]
      }
      //let cfr = getNearestValue(cob[0], basalProfile)
      //let a = getNearestValue(cob[0], openaps.current)?.openaps?.reason?.match(/CR: ([^,]*),/)[1]
      return cob.map(c => c[1] == 0 || c[1] == null ? [c[0], null] : [c[0], getNearestValue(c[0], iob).y - c[1] * 10 / findActiveCrForTimeAndDate(c[0])])
      //return iob.map(x => [x.x, x.y*2])
    }

    function setTargetLine() {
      function findActiveTTForTimeAndDate(d) {
        //cr.filter(x => x.profileStartTime < d)
        return targ.find(function (t) {
          return t.profileStartTime < d && d > returnDateWithHHMM(d, t.hour);
        }).value
        //todo: sortera cr-listans profileStartTime och hitta den cr som matchar c[1]
      }
      return bg.map(b => [b[0], findActiveTTForTimeAndDate(b[0])])
      // return openaps.current != undefined
      //   && openaps.current.length > 0 ? openaps.current.find(x => x.openaps?.suggested).openaps.suggested.targetBG / unitConverter.current : -1;
    }

    setChartData({
      //labels: sgv?.map(t => t.time),

      datasets: [
        {
          label: 'BG',
          data: bg,
          type: 'scatter',
          showLine: false,
          yAxisID: 'y',
          borderWidth: 0.5, //line width
          // borderColor: 'rgb(0, 200, 0)',
          //backgroundColor: 'rgba(0, 200, 0, 1)',
          borderColor: (context) => context.chart.chartArea ? getGradient(context.chart, 1) : null,
          backgroundColor: (context) => context.chart.chartArea ? getGradient(context.chart, .8) : null,
          fill: false
        },
        {
          label: "smb",
          data: smb,
          type: 'scatter',
          showLine: false,
          yAxisID: 'y',
          borderColor: RGB_blue,
          backgroundColor: RGB_bluea,
          fill: false,
          pointRadius: setBolusRadius,
        },
        {
          label: "bolus",
          data: mealInsu.filter(x => x.insulin != undefined).map(x => [x.x, getNearestValue(x.x, sgv.current).bg - 1, x.insulin]),
          type: 'scatter',
          showLine: false,
          yAxisID: 'y',
          borderColor: RGB_blue,
          backgroundColor: RGB_orangea.replace("0.15", "0.25"),
          fill: false,
          pointRadius: setMealBolusRadius,
          // pointRadius: setBolusRadius,
        },
        {
          label: "meal-cob",
          data: mealInsu.filter(x => x.carbs != undefined).map(x => [x.x, getNearestValue(x.x, sgv.current).bg + 1, x.carbs]),
          type: 'scatter',
          showLine: false,
          yAxisID: 'y',
          borderColor: RGB_orange,
          backgroundColor: RGB_orangea,
          fill: false,
          pointRadius: setMealCarbRadius,
        },

        {
          label: "iob",
          data: iob,
          type: 'scatter',
          showLine: true,
          yAxisID: 'y3',
          borderColor: RGB_blue,
          backgroundColor: RGB_bluea,
          fill: true,
          pointRadius: 0,
        },
        {
          label: "iobC",
          data: setIobMinusCobInsu(),
          type: 'scatter',
          showLine: true,
          yAxisID: 'y3',
          borderColor: RGB_blue,
          backgroundColor: RGB_bluea,
          borderDash: [5, 3],
          fill: true,
          pointRadius: 0,
        },
        {
          label: "cob",
          data: cob,
          type: 'scatter',
          showLine: true,
          yAxisID: 'y3',
          borderColor: RGB_orange,
          backgroundColor: RGB_orangea,
          fill: true,
          pointRadius: 0,
        },
        /*
        {
          label: "%basal",
          data: tempBasProf,
          type: 'scatter',
          showLine: true,
          yAxisID: 'y2',
          borderColor: RGB_blue,
          backgroundColor: RGB_bluea,
          fill: false,
          pointRadius: 0,
          // hidden: true,
        }, */
        {
          label: "basal",
          data: basalProfile,
          type: 'scatter',
          showLine: true,
          yAxisID: 'y2',
          borderColor: RGB_blue,
          backgroundColor: RGB_bluea,
          borderDash: [8, 5],
          fill: false,
          pointRadius: 0,
        }, {
          label: "temp basal",
          data: tempBasLoop,
          type: 'scatter',
          showLine: true,
          yAxisID: 'y2',
          borderColor: RGB_blue,
          backgroundColor: RGB_bluea,
          fill: true,
          pointRadius: 0,
        }, {
          label: "basal active",
          data: basalProfileFilled,
          type: 'scatter',
          showLine: true,
          yAxisID: 'y2',
          borderColor: RGB_blue,
          backgroundColor: 'rgba(0,0,150,0.6)',//RGB_greena.replace("0.15", "0.25"),
          fill: true,
          pointRadius: 0,
        },
        {
          label: "act",
          data: iob.map(x => [x.x, x.act * 100 * (19 - unitConverter.current)]),
          type: 'scatter',
          showLine: true,
          yAxisID: 'y',
          borderColor: RGB_red,
          fill: false,
          pointRadius: 0,
          lineBorderWidth: 0.5,
          //hidden: true,
        },
        {
          label: "sens",
          data: sens.map(x => [x[0], x[1] * (19 - unitConverter.current)]),
          type: 'scatter',
          showLine: true,
          yAxisID: 'y',
          borderColor: RGB_gray,
          backgroundColor: RGB_graya,
          fill: true,
          pointRadius: 0,
          lineBorderWidth: 0.5,
          //hidden: true,
        },
        {
          label: 'Target',
          data: setTargetLine(),
          type: 'scatter',
          showLine: true,
          yAxisID: 'y',
          borderColor: RGB_green,
          pointRadius: 0,
          borderDash: [8, 5],
          lineBorderWidth: 1.0,
          //borderWidth: 0.5, //line width
          // borderColor: 'rgb(0, 200, 0)',
          //backgroundColor: 'rgba(0, 200, 0, 1)',
          //borderColor: (context) => context.chart.chartArea ? getGradient(context.chart, 1) : null,
          //backgroundColor: (context) => context.chart.chartArea ? getGradient(context.chart, .8) : null,
          fill: false,

          // type: 'line',
          // mode: 'horizontal',
          // scaleID: 'y',
          // value: setTargetLine,
          // borderDash: [8, 5],
          // borderColor: RGB_green,
          // borderWidth: 0.5,
          // label: {
          //   enabled: false,
          // }
        },
        {
          label: "pred",
          // data: currOpenaps?.suggested?.predBGs.COB.map((x,i)=>[new Date(currOpenaps.suggested.deliverAt).getTime()+ i*1000*60*5,x/unitConverter.current]),
          type: 'scatter',
          showLine: false,
          hidden: false,
          yAxisID: 'y',
          fill: false,
          pointRadius: 2,
          borderColor: (context) => {
            var index = context.dataIndex;
            var value = context.dataset.data[index];
            if (value) {
              var col = RGB_blue;
              //console.log(value)

              switch (value[2]) {
                case "COB":
                  col = RGB_orange;
                  break;
                case "IOB":
                  col = RGB_blue;
                  break;
                case "UAM":
                  col = RGB_red;
                  break;
                case "ZT":
                  col = RGB_gray;
                  break;
                default:
                  col = RGB_blue;
              }
              return col;
            }

            return RGB_blue;
          },
        },
      ]
    });

    updateInProgress.current = false;
    console.log("setdata: " + (new Date() - start) + "ms")

  }


  // let timer;
  // function startFetch({ chart }) {
  //   const { min, max } = chart.scales.x;
  //   clearTimeout(timer);
  //   timer = setTimeout(() => {
  //     console.log('Fetched data between ' + min + ' and ' + max);
  //     chart.data.datasets[0].data = fetchData(min, max);
  //     chart.stop(); // make sure animations are not running
  //     chart.update('none');
  //   }, 500);
  // }

  const checkIfMoreDataIsNeeded = async (c) => {
    if (updateInProgress.current) return;
    //console.log(new Date(sgv[sgv.length-1].x).getTime());
    let firstDataDate = new Date(sgv.current[sgv.current.length - 1].x);
    let lastDataDate = new Date(sgv.current[0].x);
    let offset = + 1000 * 3600 * 12;
    //console.log(sgv.length);
    const xAxis = c.chart.scales.x;
    if (xAxis.min < firstDataDate.getTime()) {
      //c.chart.stop(); // make sure animations are not running
      console.log("Need older data........................");
      //var fromTime = new Date(firstDataDate.getTime() - offset);
      var fromTime = new Date(xAxis.min - offset);
      var toTime = new Date(xAxis.max + offset);
      await getData(fromTime, toTime, true);
      //c.chart.update('none');
    } else if (xAxis.max > lastDataDate.getTime() && xAxis.max < new Date().getTime()) {
      console.log("Need newer data........................");
      var fromTime = new Date(xAxis.min - offset);
      var toTime = new Date(xAxis.max + offset);
      await getData(fromTime, toTime, true);

    }
    if (xAxis.max > new Date(sgv.current[0].x).getTime()) {
      viewingHistory.current = false;
    } else {
      viewingHistory.current = true;
    }
    //console.log("checking if more data is needed")
    //console.log(sgv.length);
    // console.log(c.chart.scales.x.min)
    // if(chart.data.datasets)
    // chart.data.datasets.forEach(dataset => {
    //   dataset.data.push({
    //     x: now,
    //     y: Utils.rand(-100, 100)
    //   });
    // });

    // chart.update('none');
  }
  function drawPointLabels(c) {// onComplete: (c) =>{
    if (c?.chart.data.datasets.length == 0) return;

    var ctx = c.chart.ctx;
    c.chart.data.datasets.forEach(function (ds, i) {
      if ((ds.label == "smb" && chkSmb)
        || (ds.label == "bolus" && chkBolus)
        || (ds.label == "meal-cob" && chkCharbs)) {
        var meta = c.chart.getDatasetMeta(i);
        if (!meta.hidden) {
          meta.data.forEach(function (element, index) {
            // Draw the text in black, with the specified font
            ctx.fillStyle = RGB_gray;
            var fontSize = 16;
            var fontStyle = 'normal';
            var fontFamily = 'Helvetica Neue';
            //ctx.font = Chart.helpers.fontString(fontSize, fontStyle, fontFamily);
            // Just naively convert to string for now
            var dataString = ds.data[index][2];
            // Make sure alignment settings are correct
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = "bold 11px 'Helvetica Neue', Helvetica, Arial, sans-serif";
            var padding = -20;

            var position = element.tooltipPosition();

            if (ds.label == "meal-cob") {
              dataString += "g";
              position.y += -35;
            } else if (ds.label == "smb") {
              dataString = ds.data[index].bolus.toString().replace("0.", ".");
              position.x += 10;

            } else if (ds.label == "bolus") {
              dataString += "U";
            }
            ctx.fillText(dataString, position.x, position.y - (fontSize / 2) - padding);
          });
        }
      }
    });

  }

  const setXmin = (c) => {
    if (!ahead.current && c.chart.scales.x.min) {
      return c.chart.scales.x.min;
    } else if (sgv.current && c.chart.scales.x.min) {
      return Math.max(new Date(sgv.current[0].x), new Date(openaps.current[0].x)) - currWidth.current / 2;
    }
    //return new Date(Math.round((new Date().getTime() - 1000 * 3600 * 12) / stepSize) * stepSize);
    return new Date().getTime() - maxOffset;
  }
  const setXmax = (c) => {
    //console.log((!ahead.current && c.chart.scales.x.max!= undefined));
    if (!ahead.current && c.chart.scales.x.max) {
      return c.chart.scales.x.max;
    } else if (sgv.current && c.chart.scales.x.max) {
      return Math.max(new Date(sgv.current[0].x), new Date(openaps.current[0].x)) + currWidth.current / 2;
    }
    return new Date().getTime() + maxOffset;
  }

  const startwidthHours = 12;
  const startWidth = 1000 * 3600 * startwidthHours;
  const maxOffset = startWidth / 2;
  const stepSize = 1000 * 60 * 30; //[ms/5min]
  const chartOptions = {
    maintainAspectRatio: false,
    responsive: true,


    title: {
      display: true,
      text: 'KiteScout',
    },
    //onmousedown: () => {console.log("nu");},

    elements: {
      point: {
        radius: 3
      },
      line: {
        borderWidth: 1.5
      }
    },
    scales: {
      x: {
        // min: new Date().getTime() - 1000 * 3600 * 24 * 10,
        // max: new Date().getTime() - 1000 * 3600 * 24 * 7,
        min: setXmin,
        max: setXmax,
        grid: {
          display: false
        },
        type: 'time',
        // time: {
        //   unit: 'minute'
        // }

        ticks: {
          autoSkip: true,
          // autoSkipPadding: 20,
          maxTicksLimit: 10,
          stepSize: stepSize,
          maxRotation: 45,
          callback: (value, index, values) => {
            return value.split(" - ")[1]; //value.includes('00:00') ? value : value.split(" - ")[1];
          }
        },
        time: {
          //round: true,
          displayFormats: { //beror på zoomen:
            hour: 'DD/MM - HH:mm',
            minute: 'DD/MM - HH:mm',
            second: 'HH:mm'
          },
        }
      },

      y: {
        position: 'left',
        min: -5 * (19 - unitConverter.current),
        //max: sgv.current == undefined ? Number(settings.current.bgTargTop) * 2 : Math.ceil(Math.max(...sgv.current.map(x => x.bg))+5),
        max: sgv.current == undefined ? Number(settings.current.bgTargTop) * 2 : Math.ceil(Math.max(...sgv.current.map(x => x.bg)) / (5 * (19 - unitConverter.current)) * 5 * (19 - unitConverter.current) + 6 * (19 - unitConverter.current)),
        //max: Number(settings.current.bgTargTop) * 2,
        ticks: {
          min: 0,
          stepSize: 1,
          callback: (v, i) => v >= 0 ? v : null,
        },
        grid: {
          display: false,
        }
      },
      y2: {
        position: 'right',
        min: 0,
        max: 15,//tempBasal == undefined ? 5 : Math.ceil(Math.max(...tempBasal.map(x => x.basal)) / 5) * 10,
        ticks: {
          display: false
        }
      },
      y3: {
        position: 'right',
        min: -30,
        max: openaps.current == undefined ? 5 : Math.max(...openaps.current.map(x => x.openaps.suggested?.COB ? Math.max(x.openaps.suggested?.COB / 10, x.openaps.suggested?.IOB) : 0)) + 1,
        ticks: {
          display: false
        }
      },

    },
    animation: {

      //onComplete: drawPointLabels,
      //duration: 0, //disable animations...
      onProgress: drawPointLabels,

      x: {
        easing: 'linear',
        duration: 0, //to stop from pulling graph sideways when new data arrives.
        //from: currWidth.current/2
      },
      y: {
        duration: 500,
        //from: 0,
        easing: 'linear',
      }
    },
    plugins: {
      legend: {
        labels: {
          filter: (e, l) => {
            if (e.text.includes("basal") && e.text != "basal") return null; //only show one basal
            if (e.text.includes("cob") && e.text != "cob") return null;
            if (e.text.includes("iobC")) return null;
            if (e.text.includes("Target")) return null;
            return e;
          },

          generateLabels: (chart) => { //generera egna labels...
            const { data } = chart;

            if (data.datasets) {
              return data.datasets.map((ds, i) => {
                const meta = chart.getDatasetMeta(0);
                // const ds = data.datasets[0];
                const arc = meta.data[i];
                //         // const custom = (arc && arc.custom) || {};
                //         // const { getValueAtIndexOrDefault } = Chart.helpers;
                //         // const arcOpts = chart.options.elements.arc;
                //         // const fill = custom.backgroundColor ? custom.backgroundColor : getValueAtIndexOrDefault(ds.backgroundColor, i, arcOpts.backgroundColor);
                //         // const stroke = custom.borderColor ? custom.borderColor : getValueAtIndexOrDefault(ds.borderColor, i, arcOpts.borderColor);
                //         // const bw = custom.borderWidth ? custom.borderWidth : getValueAtIndexOrDefault(ds.borderWidth, i, arcOpts.borderWidth);
                //         // const value = chart.config.data.datasets[arc._datasetIndex].data[arc._index];

                return {
                  text: `${ds.label}`,
                  fillStyle: typeof ds.backgroundColor === 'string' ? ds.backgroundColor : (ds.label == "BG" ? RGB_greena : "rgba(0,0,0,0)"),
                  strokeStyle: typeof ds.borderColor === 'string' ? ds.borderColor : RGB_green,
                  lineWidth: 1,
                  hidden: ds.hidden,//Number.isNaN(ds.data[i]) || meta.data[i].hidden,
                  index: i,
                };
              });
            }
            return [];

          }
        },
        position: 'top',
        onHover: (event, activeElements) => {
          event.native.target.style.cursor = 'pointer';
        },
        onLeave: (event, activeElements) => {
          event.native.target.style.cursor = 'auto';
        },

        onClick: function (e, legendItem, a, b) {
          var index = legendItem.index;
          let dataSet = this.chart.getSortedVisibleDatasetMetas().filter(x => x.label === legendItem.text) //todo: göm associerade... 
          let isHidden = dataSet.length > 0 ? (dataSet.hidden ? dataSet.hidden : false) : true
          this.chart.setDatasetVisibility(index, isHidden)
          this.chart.update();
          // function setHidden(name, ci) {
          //   ci.data.datasets.forEach(function (e, i) {
          //     var meta = ci.getDatasetMeta(i);
          //     let isHidden = meta.hidden ? meta.hidden : false;
          //     if (e.label.includes(name)) {
          //       if (isHidden) {
          //         meta.hidden = null;
          //       }
          //       else {
          //         meta.hidden = true;
          //       }
          //     }
          //   });
          // }
          // var index = legendItem.index;
          // let name = legendItem.text;
          // var ci = this.chart;
          // let meta = ci.getDatasetMeta(index);
          // let isHidden = legendItem.hidden ? legendItem.hidden : meta.hidden ? meta.hidden : false;
          // if (name == "basal" || name == "cob" || name == "bolus") {
          //   setHidden(name, ci);
          // }
          // else if (isHidden) {
          //   meta.hidden = null;
          //   ci.data.datasets[index].hidden = null;

          // }
          // else {
          //   meta.hidden = true;
          //   //ci.data.datasets[index].backgroundColor = RGB_reda;

          //   // let i = a.legendItems.findIndex(x => x.text == name);
          //   // let hitbox = a.legendHitBoxes[i];
          //   // // Strikethrough the text if hidden
          //   // ci.ctx.fillStyle = "red";
          //   // ci.ctx.beginPath();
          //   // ci.ctx.lineWidth = 2;
          //   // ci.ctx.moveTo(hitbox.left, hitbox.top);
          //   // ci.ctx.lineTo(hitbox.left + hitbox.width, hitbox.top + 10);
          //   // ci.ctx.stroke();
          //   // ci.ctx.fillText("kalle", hitbox.left, hitbox.top + 10);
          // }
          // //chartRef.current.chartInstance.defaults.plugins.legend.onClick.call(this, e, legendItem, this);
          // ci.update();
        },
      },
      zoom: {
        limits: {
          x: {
            min: 0, max: new Date().getTime() + 1000 * 3600 * 24, minRange: 50
          },
          //y: {min: -200, max: 200, minRange: 50}
        },
        zoom: {
          pinch: { //make sure you specify the width of the component when used...
            enabled: true,
          },
          drag: {
            enabled: true,
            modifierKey: "ctrl"
          },
          wheel: {
            enabled: true, // SET SCROOL ZOOM TO TRUE
            //modifierKey: "shift"
          },
          mode: "x",
          speed: 20,
          onZoomComplete: (c) => {
            currWidth.current = c.chart.scales.x.max - c.chart.scales.x.min;
            setInfoData(c.chart);
            checkIfMoreDataIsNeeded(c);
          },
        },
        pan: {
          enabled: true,
          mode: "x",
          speed: 10,
          threashold: 10,
          onPanComplete: (c) => setInfoData(c.chart), //buggy, jumps back when setting a setState-varable!
          onPan: checkIfMoreDataIsNeeded,
          //onPanStart: clearInfo
        }
      },
      tooltip: {
        callbacks: {
          label: function (context, a) {
            var label = context.dataset.label || '';
            var ret = context.formattedValue;
            if (label == 'smb') {
              ret = context.raw.bolus + 'U';
            } else if (label == "meal-bolus") {
              ret = context.raw[2] + 'U';
            } else if (label == "meal-cob") {
              ret = context.raw[2] + 'g';
            } else if (label == "pred") {
              var text = "";
              switch (context.raw[2]) {
                case "COB":
                  text = "Prediction line shows where your BG will go based on the current pump settings and assuming that the deviations due carb absorption remain constant.";
                  break;
                case "IOB":
                  text = "Prediction line shows what would happen under the influence of insulin only. For example if you dialled in some insulin and then didn’t eat any carbs.";
                  break;
                case "UAM":
                  text = "Unannounced meals means that a significant increase in glucose levels due to meals, adrenaline or other influences is detected.";
                  break;
                case "ZT":
                  text = "Prediction line shows how the IOB trajectory line would change if the pump stopped all insulin delivery (0% TBR).";
                  break;

              }
              ret = [Number(ret).toFixed(2), context.raw[2] + " prediction"];
              var i = 0;
              text = text.split(" ");
              while (i < text.length) {
                ret.push(text.slice(i, i + 10).join(" "));
                i += 10;
              }
            }
            return ret;
          }
        }
      },
      annotation: {
        annotations: [

          {
            type: 'box',
            yScaleID: 'y',

            xMin: sgv.current ? sgv.current[sgv.current.length - 1].x : new Date().getTime() - currWidth.current / 2 - 2000000,
            xMax: new Date().getTime() + currWidth.current / 2,
            yMin: Number(settings.current.bgTargBot),
            yMax: Number(settings.current.bgTargTop),
            backgroundColor: 'rgba(75,255,0,0.10)',//(context) => context.chart.chartArea ? getGradient(context.chart, .8) : null,//'rgba(75,255,0,0.15)',
            borderWidth: 0,
            label: {
              enabled: false,
            }
          },
          // {
          //   type: 'line',
          //   mode: 'horizontal',
          //   scaleID: 'y',
          //   value: Number(settings.current.bgTargBot),
          //   borderColor: RGB_gray,
          //   borderWidth: 0.5,
          //   label: {
          //     enabled: false,
          //   }
          // },
          // {
          //   type: 'line',
          //   mode: 'horizontal',
          //   scaleID: 'y',
          //   value: Number(settings.current.bgTargTop),
          //   borderColor: RGB_gray,
          //   borderWidth: 0.5,
          //   label: {
          //     enabled: false,
          //   }
          // },
          {
            type: 'line',
            mode: 'horizontal',
            scaleID: 'y',
            value: 0,
            borderColor: RGB_gray,
            borderWidth: 0.5,
            label: {
              enabled: false,
            }
          },
          // {
          //   type: 'line',
          //   mode: 'horizontal',
          //   scaleID: 'y',
          //   value: setTargetLine,
          //   borderDash: [8, 5],
          //   borderColor: RGB_green,
          //   borderWidth: 0.5,
          //   label: {
          //     enabled: false,
          //   }
          // },
          {
            type: 'line',
            mode: 'horizontal',
            scaleID: 'y3',
            value: 0,
            borderColor: RGB_gray,
            borderWidth: 0.5,
            label: {
              enabled: false,
            }
          },
          {
            mode: 'vertical',
            type: 'line',
            scaleID: 'x',
            //value: (c) => !havPanned ? c.chart.scales['x']._userMax - maxOffset : c.chart.scales['x']._userMax - (c.chart.scales['x']._userMax-c.chart.scales['x']._userMin)/4,
            value: redrawCurrBGLine,
            borderColor: RGB_gray,
            borderWidth: 0.5,
            label: {
              backgroundColor: 'rgba(0,0,0,0)',
              //content: redrawCurrBGText,
              enabled: false,
              position: 'start', //position top
              yAdjust: 0, //down offset from position
            }
          },
        ]
      }

    },
  };

  var lastBGLinePos = -100;
  function redrawCurrBGLine(c) {
    currBGLinePos.current = c.chart.scales.x.max - (c.chart.scales.x.max - c.chart.scales.x.min) / 2;
    return currBGLinePos.current;
  }


  function setPredLines() {
    if (chartRef.current.data.datasets.length > 0) {
      let currO = getNearestValue(currBGLinePos.current, openaps.current)?.openaps;
      var data = currO?.suggested?.predBGs?.COB ? currO.suggested.predBGs.COB.map((x, i) => [new Date(currO.suggested.deliverAt).getTime() + i * 1000 * 60 * 5, x / unitConverter.current, "COB"]) : [];
      data = data.concat(currO?.suggested?.predBGs?.IOB ? currO.suggested.predBGs.IOB.map((x, i) => [new Date(currO.suggested.deliverAt).getTime() + i * 1000 * 60 * 5, x / unitConverter.current, "IOB"]) : []);
      data = data.concat(currO?.suggested?.predBGs?.UAM ? currO.suggested.predBGs.UAM.map((x, i) => [new Date(currO.suggested.deliverAt).getTime() + i * 1000 * 60 * 5, x / unitConverter.current, "UAM"]) : []);
      data = data.concat(currO?.suggested?.predBGs?.ZT ? currO.suggested.predBGs.ZT.map((x, i) => [new Date(currO.suggested.deliverAt).getTime() + i * 1000 * 60 * 5, x / unitConverter.current, "ZT"]) : []);
      chartRef.current.data.datasets.find(x => x.label === 'pred').data = data;
      //c.update();
    }
  }
  function setInfoData(c) {
    var retStr = "";
    if (sgv.current && openaps.current) {
      let currO = getNearestValue(currBGLinePos.current, openaps.current)?.openaps
      setPredLines();
      let currSug = currO.suggested;
      if (c.scales) {
        currBGLinePos.current = c.scales.x.max - (c.scales.x.max - c.scales.x.min) / 2;
      }
      let bs = getNearestValue(currBGLinePos.current, sgv.current);
      console.log("cur:" + new Date(currBGLinePos.current).toISOString() + "\nbs: " + bs.x + "\nmax:" + sgv.current[0].x + "\nmin:" + sgv.current[sgv.current.length - 1].x);
      if (new Date(bs.x) >= new Date(sgv.current[1].x)) {
        ahead.current = true;
        bs = sgv.current[0];
        if (openaps.current?.openaps) {
          currO = openaps.current?.openaps;
        }
      } else {
        ahead.current = false;
      }
      let dbg = currSug?.tick ? Number(currSug.tick) > 0 ? "+" + (Number(currSug.tick) / unitConverter.current).toFixed(1) : (Number(currSug.tick) / unitConverter.current).toFixed(1) : "";
      //console.log("svg.current: " + sgv.current[0].bg)
      console.log("bs.bg: " + bs.bg.toFixed(1))

      setCurrInfo({
        bg: bs.bg.toFixed(1),
        dBg: dbg,
        iob: currO.iob.iob.toFixed(1),
        act: (currO.iob.activity * 100).toFixed(1),
        cob: currSug?.COB ? currSug.COB.toFixed(1) : "",
        sens: currSug?.sensitivityRatio ? (currSug.sensitivityRatio * 100).toFixed(0) : "",
        basal: getNearestValue(currBGLinePos.current, tempBasal.current).basal.toFixed(2),
        reason: currSug?.reason
      })
      console.log("Setting info data")
      // c.stop();// make sure animations are not running
      let lastDataDate = new Date(sgv.current[0].x);
      let predDatasetIndex = c.data.datasets.findIndex(x => x.label === 'pred')
      if (currBGLinePos.current >= lastDataDate.getTime()) {
        c.setDatasetVisibility(predDatasetIndex, true)
      } else {
        c.setDatasetVisibility(predDatasetIndex, false)
      }
      // c.update();

      //lastBGLinePos = currBGLinePos.current;
    }
    return retStr;
  }

  async function clearInfo() {
    //await new Promise(resolve => setTimeout(resolve, 1000));
    //setCurrInfo(null); //gör tyvärr att allt laggar...
  }

  function redrawCurrBGText(c) {
    // var retStr = "";
    // if (sgv.current?.length > 0 && Math.abs(currBGLinePos - lastBGLinePos) > 1000 * 60 * 20) {
    //   // setCurrBG(getNearestValue(currBGLinePos, sgv).bg.toFixed(1));
    //   // let currOpenAps = getNearestValue(currBGLinePos, openaps).openaps
    //   // setCurrIOB(currOpenAps.iob.iob.toFixed(1));
    //   // setCurrAct(currOpenAps.iob.activity.toFixed(3));
    //   // let currSug = currOpenAps.suggested;
    //   // setCurrCOB(currSug?.COB ? currSug.COB.toFixed(1) : "");
    //   // setCurrSens(currSug?.sensitivityRatio ? (currSug.sensitivityRatio*100).toFixed(0) : "");
    //   lastBGLinePos = currBGLinePos;
    // }
    // return retStr;
  }

  function getNearestValue(val, data) {
    return data?.length > 0 ? data.reduce((a, b) => Math.abs(new Date(b.x) - val) < Math.abs(new Date(a.x) - val) ? b : a) : null;
  }

  function createTooltip(reason) {
    var ret = reason ? reason.split(";") : "2";//replaceAll(";", "<br>") : "";
    if (ret?.length >= 2 && (ret[1].includes("Eventual BG") || ret[1].includes("minGuardBG"))) {
      let bg = ret[1].trim().replace("Eventual BG", "bg").replace("<", " ").split(" ")[1];
      ret = ret[0].split(",").find(x => x.includes(bg))?.trim();
    }
    return ret;
  }
  return (
    <div className="App">
      <div className="info" style={{ maxHeight: "30vh" }}>

        <table className="infoTable">
          <tbody>
            <tr>
              <td rowspan="5" style={{ verticalAlign: "bottom" }} >
                <span style={currInfo?.dBg.includes("-") ? { color: RGB_red, fontSize: "1.8vmin" } : { color: RGB_green, fontSize: "1.8vmin" }}>({
                  currInfo ? settings.current?.displayUnits?.includes("mmol") ? (currInfo?.dBg.includes("-") ? "" : "+") + Number(currInfo?.dBg).toFixed(1) : (currInfo?.dBg.includes("-") ? "" : "+") + Number(currInfo?.dBg).toFixed(0) : ""
                })</span><br />
                <TimeCounter lastFetch={lastFetch} />
              </td>
            </tr>
            <tr>
              <td rowspan="5" style={{ verticalAlign: "bottom" }} >
                <span style={currInfo?.bg > settings.current.bgTargBot && currInfo?.bg < settings.current.bgTargTop ? { color: RGB_green, fontSize: "12vmin" } : { color: RGB_red, fontSize: "12vmin" }}>
                  {currInfo ? settings.current?.displayUnits?.includes("mmol") ? Number(currInfo?.bg).toFixed(1) : Number(currInfo?.bg).toFixed(0) : ""}
                </span>
              </td>
            </tr>
            <tr>
              <td colSpan="1">IOB:</td>
              <td><b>{currInfo?.iob}</b></td>
              <td style={{ paddingLeft: "0px" }}>U</td>
              <td>COB:</td>
              <td><b>{currInfo?.cob}</b></td>
              <td style={{ paddingLeft: "0px" }}>g</td>
            </tr>
            <tr>
              <td colSpan="1" data-tip="Temporary basal set by your looping software">Basal:</td>
              <td data-tip="Temporary basal set by your looping software"><b>{currInfo?.basal}</b></td>
              <td style={{ paddingLeft: "0px" }}></td>
              <td>Autosens:</td>
              <td><b>{currInfo?.sens}</b></td>
              <td style={{ paddingLeft: "0px" }}>%</td>
            </tr>
            <tr>
              <td data-tip="CR (or IC) = grams of carbs per unit of insulin">CR:</td>
              <td data-tip="CR (or IC) = grams of carbs per unit of insulin"><b>{currInfo?.reason?.match(/CR: ([^,]*),/)[1]}</b></td>
              <td style={{ paddingLeft: "0px" }}></td>
              <td data-tip="ISF = 1 unit of insulin will lower your BG by this amount<br />(mmol/l or mg/dl)">ISF:</td>
              <td data-tip="ISF = 1 unit of insulin will lower your BG by this amount<br />(mmol/l or mg/dl)"><b>{currInfo?.reason?.match(/ISF: ([^,]*),/)[1]}</b></td>
              <td style={{ paddingLeft: "0px" }}></td>
            </tr>
          </tbody>
        </table>

        <ReactTooltip multiline={true} className="tooltip" />
      </div>
      <div style={{ height: "65vh" }}>
        <Line className="MainChart"
          ref={chartRef}
          options={chartOptions}
          data={chartData}
          style={{
            backgroundColor: "black",
            // height: "50vh",
            // marginTop: "50px",
          }}
        />
      </div>
      <div style={{ marginBottom: "1vh" }} className="chkboxes">
        Display: smb
        <input
          type="checkbox"
          checked={chkSmb}
          onChange={e => setChkSmb(e.target.checked)}
        /> bolus<input
          type="checkbox"
          checked={chkBolus}
          onChange={e => setChkBolus(e.target.checked)}
        /> carbs<input
          type="checkbox"
          checked={chkCharbs}
          onChange={e => setChkCarbs(e.target.checked)}
        /><button onClick={async () => {
          chartRef.current.scales.x.max = new Date().getTime() + currWidth.current / 2
          chartRef.current.scales.x.min = new Date().getTime() - currWidth.current / 2
          chartRef.current.update();
          await getData(new Date().setTime(new Date().getTime() - 1000 * 3600 * 24), new Date(), true);
          setPredLines();
        }} className="panBtn" data-tip={'Go to current time'}>{'>>'}</button>
      </div>
      <div className="reason" style={{ border: '1px solid gray', display: "inline-block", padding: "1vh" }} data-tip={currInfo ? currInfo.reason : ""} >

        {currInfo?.reason ? "(" + createTooltip(currInfo.reason) + ") " + currInfo.reason.split(";")[1] : " "}<br />

        {currInfo?.reason ? currInfo.reason.split(";")[2] : " "}
      </div>
    </div>
  );
}

export default App;
