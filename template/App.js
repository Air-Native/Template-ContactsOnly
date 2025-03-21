import React, { Component } from 'react';
import {
  Alert,
  BackHandler,
  Vibration,
  StyleSheet,
  View,
  Platform,
  PermissionsAndroid,
  StatusBar,
  Image,
  SafeAreaView,
  Linking,
  AppState,
  NativeModules,
} from 'react-native';

import { WebView } from 'react-native-webview';
import NetInfo from '@react-native-community/netinfo';
import createInvoke from 'react-native-webview-invoke/native';
import FingerprintScanner from 'react-native-fingerprint-scanner';
import Share from 'react-native-share';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';
import Geolocation from '@react-native-community/geolocation';
import RNBootSplash from 'react-native-bootsplash';
import { URL } from 'react-native-url-polyfill';
import KeepAwake from 'react-native-keep-awake';
import changeNavigationBarColor from 'react-native-navigation-bar-color';

import OneSignal from './controllers/OneSignal'

import Player from './controllers/Player'

const PlayerInstance = new Player()

const { ImageClipboard } = NativeModules;


/** Contacts */
import Contacts from 'react-native-contacts';
const enableContacts = true;


/** OneSignal App ID - тут ставит id приложения юзера для инициализации OneSignal */
OneSignal.initialize();

/** Если поставить
 *  setFullscreenWithoutBar = true
 *  будет фулскрин приложение без шторки
 */
const setFullscreenWithoutBar = false;
const USER_AGENT = "Mozilla/5.0 (Linux; Android 5.0.1; Nokia 1000 wifi Build/GRK39F) AppleWebKit/533.12 (KHTML, like Gecko)  Chrome/50.0.1011.255 Mobile Safari/600.7"

/** Если поставить
 *  setFullscreenWithBar = true
 *  будет фулскрин приложение с прозрачной шторкой
 */
const setFullscreenWithBar = true;

/** Ссылка на приложение юзера */
const userURL = 'https://gentingtaxiservice.com/version-test/rider_page/sample:user';

/** Уникальная схема для приложения юзера, тут надо использовать то же самое название что при создании схемы */
const scheme = 'gentingtaxiapp://';

/** Мы эмулируем бутсплэш, для этого берем иконку и делаем такой же фон как у бутсплэша */
const bootsplashColor = '#FFFFFF';

/** Размеры иконки бутсплэша */
const logoWidth = 100;

var urlData = new URL(userURL);
const hostURL = urlData.origin;

if (setFullscreenWithoutBar || setFullscreenWithBar) {
  StatusBar.setTranslucent(true); //если нужно чтоб приложение на android было под status bar -> true
}

if (setFullscreenWithoutBar) {
  StatusBar.setHidden(true);
}

if (setFullscreenWithBar) {
  StatusBar.setHidden(false);
  StatusBar.setBackgroundColor('#FFFFFF00');
}

if (Platform.OS === "android") {
  /**
   * color
   * white icons? => true/false, if true -> icons white color
   * animated? => animate color change
   */
  changeNavigationBarColor("#000000", true, false);
}

const INJECTED_JAVASCRIPT = `(function() {
  const meta = document.createElement('meta'); meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'); meta.setAttribute('name', 'viewport'); document.getElementsByTagName('head')[0].appendChild(meta);
})();`;

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      inAppBrowserAvailable: false,
      isConnected: true,
      watchID: null,
      firstLoad: true,
      bgColor: '#FFF',
      appState: AppState.currentState,
      currentURL: userURL,
      canGoBack: false
    };
  }

  componentDidMount() {

    // Check in app browser availability
    InAppBrowser.isAvailable().then(available => {
      this.setState({ inAppBrowserAvailable: available });
    });


    Linking.addEventListener('url', ({ url }) => {
      if (this.webview && this.state.isConnected) {
        this.webview.injectJavaScript(
          `window.location.href = "${url.replace(
            scheme,
            'https://',
          )}"`,
        );
      }
    });

    this.appStateChecker = AppState.addEventListener('change', newState => {
      if (
        this.state.appState.match(/inactive|background/) &&
        newState === 'active' &&
        this.state.isConnected
      ) {
        this.triggerEvent('loaded_from_background');
      }

      this.setState({
        appState: newState,
      });
    });


    PlayerInstance.setupPlayer()
    // setTimeout(PlayerInstance.play, 25000)

    this.invoke
      .define("play", PlayerInstance.play)
      .define("pause", PlayerInstance.pause)
      .define("addToQueue", PlayerInstance.addToQueue)
      .define("setQueue", PlayerInstance.setQueue)
      .define("playNext", PlayerInstance.playNext)
      .define("playPrevious", PlayerInstance.playPrevious)
      .define("setVolume", PlayerInstance.setVolume)
      .define("setRepeatMode", PlayerInstance.setRepeatMode)
      .define("getCurrentTrack", PlayerInstance.getCurrentTrack)
      .define("getCurrentState", PlayerInstance.getCurrentState)


    BackHandler.addEventListener('hardwareBackPress', this.backAction);

    this.invoke.define('biometrycScan', this.authCurrent);
    this.invoke.define('oneSignalGetId', OneSignal.oneSignalGetId);
    this.invoke.define('alertWord', this.alertWord);
    this.invoke.define('stopScaner', this.stopScaner);
    this.invoke.define('vibration', this.makeBrr);
    this.invoke.define('camera', this.getCamera);
    this.invoke.define('share', this.share);
    this.invoke.define('startLocationTracking', this.startLocationTracking);
    this.invoke.define('stopLocationTracking', this.stopLocationTracking);
    this.invoke.define('setStatusBarColor', this.setStatusBarColor);
    this.invoke.define('getDeviceOS', this.getDeviceOS);
    this.invoke.define('showPrompt', OneSignal.showPrompt);
    this.invoke.define('getPermissionsUser', this.getPermissionsUser);
    this.invoke.define('openExternalLink', this.openExternalLink);



    this.invoke.define('copyBase64ImageToClipboard', this.copyBase64ImageToClipboard);

    this.invoke.define('keepAwake', this.changeKeepAwake);

    this.invoke.define('getContacts', this.getContacts);

    NetInfo.addEventListener(state => {
      this.setState({
        isConnected: state.isConnected,
      });
      this.render();
    });
  }

  componentWillUnmount() {
    this.appStateChecker.remove();
  }

  /** Copy Image To Clipboard */
	copyBase64ImageToClipboard = (base64Image) => {
		if (Platform.OS === 'ios') return;


		const pureBase64 = base64Image.replace(/^data:image\/\w+;base64,/, ""); // Remove data prefix

			ImageClipboard.copyBase64ImageToClipboard(pureBase64)
				.then(() => {
					console.log('Image copied to clipboard');
				})
				.catch((error) => {
					console.error(error);
				})
	}

  getPermissionsUser = async (permissionName) => {
    const PERMISSION_LIST = {
      location: PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      read: PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      camera: PermissionsAndroid.PERMISSIONS.CAMERA,
      write: PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    };

    try {
      if (!PERMISSION_LIST[permissionName]) throw new Error("This permission can't be requested")
      if (permissionName === 'read' && Platform.Version >= 33) {
        const readImages = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
        const readVideos = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO);
        const readMediaUser = (Platform.Version > 33) ? await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VISUAL_USER_SELECTED) : true;

        if (readImages && readVideos && readMediaUser) {
          return {
            currentPermissionStatus: true,
            reason: 'granted'
          }
        } else {
          const permissionsToRequest = [
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          ];

          if (Platform.Version > 33) permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VISUAL_USER_SELECTED)

          const response = await PermissionsAndroid.requestMultiple(permissionsToRequest);
          if (response[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] === 'granted' &&
            response[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] === 'granted' &&
            response[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VISUAL_USER_SELECTED] === 'granted') {
            return {
              currentPermissionStatus: true,
              reason: 'granted'
            }
          } else {
            return {
              currentPermissionStatus: false,
              reason: 'denied'
            }
          }

        }
      }

      const currentPermissionStatus = await PermissionsAndroid.check(PERMISSION_LIST[permissionName]);
      if (currentPermissionStatus) {
        return {
          currentPermissionStatus: currentPermissionStatus,
          reason: 'denied'
        }
      }
      const response = await PermissionsAndroid.request(PERMISSION_LIST[permissionName]);
      return {
        currentPermissionStatus: currentPermissionStatus,
        reason: response
      }

    } catch (error) {
      Alert.alert('Get permission error: ', error.message);
    }
  };

  /** Open External Link */
  openExternalLink = (url = '', inAppBrowser = false) => {
    try {
      if (!url) return false;
      if (inAppBrowser && this.state.inAppBrowserAvailable) {
        InAppBrowser.open(url, {
          modalPresentationStyle: 'fullScreen',
        });
        return;
      }

      Linking.canOpenURL(url)
        .then(canOpen => {
          if (canOpen) Linking.openURL(url);
        })

    } catch (error) {
      console.error('Open external link error: ', error);
    }
  };

  /** Enable Keep Awake */
  changeKeepAwake = (shouldBeAwake) => {
    if (shouldBeAwake) {
      KeepAwake.activate();
    } else {
      KeepAwake.deactivate();
    }
  };

  /** Platform OS */
  getDeviceOS = () => {
    return Platform.OS;
  };

  /** Contacts */
  getContacts = () => {
    return new Promise((resolve, reject) => {
      Contacts.checkPermission().then(permission => {
        if (permission === 'undefined') {
          Contacts.requestPermission().then(() => {
            resolve(this.getContacts());
          });
        }
        if (permission === 'authorized') {
          Contacts.getAll().then(contacts => {
            let listOfContacts = contacts.map((contact, index, array) => {
              return {
                _p_familyName: contact.familyName,
                _p_givenName: contact.givenName,
                _p_middleName: contact.middleName,
                _p_firstNumber:
                  contact.phoneNumbers[0] !== undefined
                    ? contact.phoneNumbers[0].number
                    : '',
                _p_secondNumber:
                  contact.phoneNumbers[1] !== undefined
                    ? contact.phoneNumbers[1].number
                    : '',
                _p_thirdNumber:
                  contact.phoneNumbers[2] !== undefined
                    ? contact.phoneNumbers[2].number
                    : '',
                _p_birthday:
                  contact.birthday !== null && contact.birthday !== undefined
                    ? new Date(
                      contact.birthday.year,
                      contact.birthday.month,
                      contact.birthday.day,
                    )
                    : null,
                _p_emailAddress:
                  contact.emailAddresses[0] !== undefined
                    ? contact.emailAddresses[0].email
                    : '',
              };
            });
            resolve(listOfContacts);
          });
        }
        if (permission === 'denied') {
          resolve('Permission to contacts denied!');
        }
      });
    });
  };
  /** -------- */


  /** Функция для отключения Splash Scree */
  firstLoadEnd = () => {
    if (this.state.firstLoad) {
      this.setState({
        firstLoad: false,
      }); //Указываем что первая загрузка была и более сплэш скрин нам не нужен
      RNBootSplash.hide(); // Отключаем сплэш скрин
      Linking.getInitialURL().then(url => {
        if (url && this.state.isConnected) {
          this.webview.injectJavaScript(
            `window.location.href = "${url.replace(
              scheme,
              'https://',
            )}"`,
          );
        }
      });
    }
  };

  /** Status Bar Settings */
  setStatusBarColor = (
    color = '#000000',
    animated = true,
    barStyle = 'default',
    barAnimated = true,
  ) => {
    /** Возвможные стили бара 'default', 'dark-content', 'light-content' */
    //console.log(barStyle);
    StatusBar.setBarStyle(barStyle, barAnimated);
    //StatusBar.setNetworkActivityIndicatorVisible();
    if (Platform.OS !== 'ios') {
      //ios не поддерживает изменения цвета

      if (color === undefined || color === null) {
        color = '#ffffff';
      }

      if (animated === undefined || animated === null) {
        animated = true;
      }

      StatusBar.setBackgroundColor(color, animated);
    } else if (color !== '#000000' && color !== null && color !== undefined) {
      this.setState({
        bgColor: color,
      });
    }
  };

  /** Status Bar Settings End */

  /** Geodata Settings */
  geoSuccess = position => {
    this.publishState('current_position', {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    });

    this.publishState('speed', position.coords.speed); // Скорость движения
    this.publishState('heading', position.coords.heading); // Направление
    this.publishState('altitude', position.coords.altitude); // Высота
  };

  geoError = error => {
    this.publishState('current_position', "");
    //  Alert.alert('Geo Error:', `${JSON.stringify(error)}`);
    /** Нужно придумать что-то для вывода ошибок, а то бесит через алёрты это делать
     * Может быть тригерить евент "Ошибка" и в стэйт передавать инфо о ошибке.
     */
  };

  startLocationTracking = (
    hightAccuracy = true,
    distance = 5,
    maximumAge = 30,
  ) => {
    /** Перестраховка значений по умолчнанию */
    if (hightAccuracy === null || hightAccuracy === undefined) {
      hightAccuracy = true;
    }
    if (distance === null || distance === undefined) {
      distance = 5;
    }
    if (maximumAge === null || maximumAge === undefined) {
      maximumAge = 30;
    }

    Geolocation.getCurrentPosition(this.geoSuccess, this.geoError, {
      enableHighAccuracy: hightAccuracy, // Если true - GPS, иначе WIFI
    });
    /** watchID это уникальный ID геосессии, по нему можно прекратить геосессию */
    let watchID = Geolocation.watchPosition(this.geoSuccess, this.geoError, {
      enableHighAccuracy: hightAccuracy, // Если true - GPS, иначе WIFI
      distanceFilter: distance, //Дистанция после изменения которой снова можно запрашивать геолокация ( вроде в метрах )
      maximumAge: maximumAge, //Время жизни кэша позиции в миллисекундах
    });

    this.setState({
      watchID: watchID,
    });
  };

  stopLocationTracking = () => {
    if (this.state.watchID !== null) {
      Geolocation.clearWatch(this.state.watchID); //Работает как очистка interval
    }

    this.setState({
      watchID: null,
    });
  };

  /** End geodata settings */

  share = options => {
    Share.open(options)
      .then(res => {
        console.log(res);
      })
      .catch(err => {
        err && console.log(err);
      });
  };

  requiresLegacyAuthentication = () => {
    return Platform.Version < 23;
  };

  authCurrent = async (question = 'Log in with Biometrics') => {
    const params = {}
    if (Platform.OS === 'ios') params.description = question
    if (Platform.OS === 'android') params.title = question
    return await new Promise((resolve) => {
      try {
        FingerprintScanner.isSensorAvailable()
          .then(() => {
            FingerprintScanner.authenticate(params)
              .then(() => resolve(true))
              .catch((error) => {
                resolve(false)
              })
          })
          .catch((error) => {
            Alert.alert('Fingerprint Authentication', error.message)
            resolve(false)
          })
      } catch (err) {
        resolve(false)
      }
    })
  };

  alertWord = (title, text) => {
    Alert.alert(title, text);
  };

  stopScaner = () => {
    FingerprintScanner.release();
  };

  authLegacy = () => {
    FingerprintScanner.authenticate({
      title: 'Log in with Biometrics',
    })
      .then(() => {
        this.triggerByometrycs(true);
      })
      .catch(error => {
        this.triggerByometrycs(false);
      });
  };

  backAction = e => {
    if (this.webview && this.state.canGoBack) this.webview.goBack();
    this.triggerEvent('back_button');
    return true;
  };

  makeBrr = seconds => {
    let ms = 1000;
    if (seconds === undefined || seconds === null) {
      Vibration.vibrate();
    } else {
      let duration = 1;

      if (typeof seconds === 'number') {
        duration = seconds;
      } else if (typeof seconds === 'string') {
        duration = parseInt(seconds);
      }

      Vibration.vibrate(duration * ms);
    }
  };

  invoke = createInvoke(() => this.webview);

  biometrycScan = () => {
    if (Platform.OS === 'android' && !this.requiresLegacyAuthentication()) {
      this.authLegacy();
    } else {
      this.authCurrent();
    }
  };

  triggerByometrycs = this.invoke.bind('triggerScanResult');
  /** Извлекаем прямо из бабла функции, тут же можно прописать загрузку файлов в bubble */
  publishState = this.invoke.bind('publishState');
  triggerEvent = this.invoke.bind('triggerEvent');

  permissionsGet = async () => {

    let camera = PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.CAMERA,
    );
    let write = PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );
    let location = PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    let read = null;
    let readMediaUser = PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
    let readImages = PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
    let readVideos = PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
    // Android 13 (Version 33)
    if (Platform.Version >= 33) {
      readImages = PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
      readVideos = PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO);
    }

    // Android 14 (Version 34)
    if (Platform.Version > 33) {
      readMediaUser = PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VISUAL_USER_SELECTED);
    }

    // For <= 12 android => use old permissions
    if (Platform.Version <= 32) {
      read = PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      );
    }

    if (Platform.Version >= 33) {
      if (readImages !== PermissionsAndroid.RESULTS.GRANDTED &&
        readImages !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        );
      }

      if (readVideos !== PermissionsAndroid.RESULTS.GRANDTED &&
        readVideos !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        );
      }
    }

    if (Platform.Version > 33) {
      if (readMediaUser !== PermissionsAndroid.RESULTS.GRANDTED &&
        readMediaUser !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VISUAL_USER_SELECTED,
        );
      }
    }

    // let read = PermissionsAndroid.check(
    //   PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    // );

    if (enableContacts) {
      let contacts = PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
      );

      if (
        contacts !== PermissionsAndroid.RESULTS.GRANDTED &&
        contacts !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
      ) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        );
      }
    }
    if (
      read !== PermissionsAndroid.RESULTS.GRANDTED &&
      read !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    ) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      );
    }

    if (
      write !== PermissionsAndroid.RESULTS.GRANDTED &&
      write !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    ) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      );
    }

    if (
      camera !== PermissionsAndroid.RESULTS.GRANDTED &&
      camera !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    ) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
    }

    if (
      location !== PermissionsAndroid.RESULTS.GRANDTED &&
      location !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    ) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
    }
  };

  loadEndFunction = () => {
    /** Функции для выполнения при полной загрузке страницы в WebView. Скорее всего RN Loader будет отключаться отсюда */
    if (Platform.OS !== 'ios') {
      this.permissionsGet();
    }
    this.firstLoadEnd();
    PlayerInstance.bindFunctions(this.invoke)
    this.publishState('platform_os', Platform.OS); //Возвращаем операционку
  };

  runFunction = fun => {
    if (typeof fun === 'function') {
      fun();
    }
  };

  onContentProcessDidTerminate = () => this.webview.reload();

  handleWebViewNavigationStateChange = (navState) => {
    const { url } = navState;

    if (!url) return false;

    if (
      !url.includes(hostURL) &&
      !url.includes(scheme) &&
      !url.includes('auth') &&
      !url.includes('.bubbleapps.io/api/1.1/oauth_redirect')
    ) {
      // this.webview.stopLoading();
      InAppBrowser.isAvailable().then(available => {
        if (available) {
          InAppBrowser.open(url, {
            modalPresentationStyle: 'fullScreen',
          });
        } else {
          Linking.canOpenURL(url).then(canOpen => {
            if (canOpen) Linking.openURL(url);
          });
        }
      });
      return false;
    } else {
      this.setState({
        currentURL: url,
        canGoBack: navState.canGoBack
      });

      return true;
    }
  };

  render() {
    if (this.state.isConnected) {
      if (setFullscreenWithoutBar || setFullscreenWithBar) {
        return (
          <View
            style={{
              ...styles.safeareastyle,
              backgroundColor: this.state.bgColor,
            }}>
            <WebView
              useWebKit
              injectedJavaScript={INJECTED_JAVASCRIPT}
              ref={ref => (this.webview = ref)}
              onContentProcessDidTerminate={this.onContentProcessDidTerminate}
              onNavigationStateChange={this.handleWebViewNavigationStateChange}
              decelerationRate={'normal'}
              onMessage={this.invoke.listener}
              allowsBackForwardNavigationGestures={true}
              allowsInlineMediaPlayback={true}
              startInLoadingState={true}
              sharedCookiesEnabled={true}
              userAgent={USER_AGENT}
              renderLoading={() => {
                return (
                  <View
                    style={{
                      backgroundColor: bootsplashColor, //Bootsplash color
                      height: '100%',
                      width: '100%',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                    <Image
                      style={{
                        width: logoWidth,
                        height: logoWidth,
                        resizeMode: "contain",
                      }}
                      source={require('./sources/boot.png')} //Bootsplash image
                    />
                  </View>
                );
              }}
              source={{
                uri: userURL,
              }}
              onLoadEnd={this.loadEndFunction}
            />
          </View>
        );
      } else {
        return (
          <SafeAreaView
            style={{
              ...styles.safeareastyle,
              backgroundColor: this.state.bgColor,
            }}>
            <WebView
              useWebKit
              injectedJavaScript={INJECTED_JAVASCRIPT}
              ref={ref => (this.webview = ref)}
              onContentProcessDidTerminate={this.onContentProcessDidTerminate}
              onNavigationStateChange={this.handleWebViewNavigationStateChange}
              decelerationRate={'normal'}
              onMessage={this.invoke.listener}
              allowsBackForwardNavigationGestures={true}
              allowsInlineMediaPlayback={true}
              startInLoadingState={true}
              sharedCookiesEnabled={true}
              userAgent={USER_AGENT}
              renderLoading={() => {
                return (
                  <View
                    style={{
                      backgroundColor: bootsplashColor, //Bootsplash color
                      height: '100%',
                      width: '100%',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                    <Image
                      style={{
                        width: logoWidth,
                        height: logoWidth,
                        resizeMode: "contain",
                      }}
                      source={require('./sources/boot.png')} //Bootsplash image
                    />
                  </View>
                );
              }}
              source={{
                uri: userURL,
              }}
              onLoadEnd={this.loadEndFunction}
            />
          </SafeAreaView>
        );
      }
    } else {
      if (setFullscreenWithoutBar || setFullscreenWithBar) {
        return (
          <View style={styles.containerNoInternet}>
            <Image
              source={require('./sources/no_internet.png')}
              style={styles.imagestyle}
              onLoadEnd={this.firstLoadEnd()}
            />
          </View>
        );
      } else {
        this.setStatusBarColor();
        return (
          <SafeAreaView style={styles.containerNoInternet}>
            <Image
              source={require('./sources/no_internet.png')}
              style={styles.imagestyle}
              onLoadEnd={this.firstLoadEnd()}
            />
          </SafeAreaView>
        );
      }
    }
  }
}

const styles = StyleSheet.create({
  safeareastyle: {
    flex: 1,
  },
  imagestyle: {
    resizeMode: 'contain',
    width: '100%',
  },
});

export default App;
