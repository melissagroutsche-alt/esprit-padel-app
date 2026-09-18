import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { initializeApp, getApp } from "firebase/app";
import { getFirestore, doc as fbDoc, setDoc, onSnapshot, getDoc as fbGetDoc } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import TaskPlanningWorkspace from "./TaskPlanningWorkspace";
import { useAuth } from "./auth/AuthContext";
import { loginUser, logoutUser, resetPassword } from "./auth/authService";

// ── Feature flag — Phase 2.1 ───────────────────────────────────────────────
// true  → Firebase Auth actif (staging develop)
// false → ancien système (rollback immédiat)
const USE_FIREBASE_AUTH = true;

// Firebase init
let _fb_db = null;
let _fb_storage = null;
let _fb_messaging = null;
let _fb_ready = false;
try {
  const app = initializeApp({
    apiKey: "AIzaSyDsl7R4EAHI-u6SdgyAqvO725GX8Hnoq5U",
    authDomain: "esprit-padel-communication.firebaseapp.com",
    projectId: "esprit-padel-communication",
    storageBucket: "esprit-padel-communication.firebasestorage.app",
    messagingSenderId: "407619706622",
    appId: "1:407619706622:web:c748b160827c34dee34faf"
  });
  _fb_db = getFirestore(app);
  _fb_storage = getStorage(app);
  try { _fb_messaging = getMessaging(app); console.log("Firebase Messaging initialized"); } catch (e) { console.warn("Firebase Messaging not available:", e.message); }
  _fb_ready = true;
} catch(e) { /* Firebase not available */ }
const LOGO_URI = "data:image/png;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAACPqADAAQAAAABAAAAlAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAlAI+AwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAQEBAQEBAgEBAgMCAgIDBAMDAwMEBgQEBAQEBgcGBgYGBgYHBwcHBwcHBwgICAgICAkJCQkJCwsLCwsLCwsLC//bAEMBAgICAwMDBQMDBQsIBggLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLC//dAAQAJP/aAAwDAQACEQMRAD8A/lpFLSe9GM10AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRjtRik9qAFFLSe9GM0AAxRj3xRikoA//Q/lpANHPSjFGMV0AGKOnSj2o4oAADRz0oxRjFABijp0o9qOKAAA0c9KMUYxQAYo6dKPajigAANHPSjFGMUAGKOnSj2o4oAADRz0oxRjFABijp0o9qOKAAA0c9KMUYxQAYo6dKPajigAANHPSjFGMUAGKOnSj2o4oAADRz0oxRjFABijp0o9qOKAAA0c9KMUYxQAYo6dKPajigAANHPSjFGMUAGKOnSj2o4oAADRz0oxRjFABijp0o9qOKAAA0c9KMUYxQAYo6dKPajigAANHPSjFGMUAGKOnSj2o4oAADRz0oxRjFABijp0o9qOKAAA0c9KMUYxQAYo6dKPajigAANHPSjFGMUAGKOnSj2o4oAADRz0oxRjFABijp0o9qOKAAA0c9KMUYxQAYoo9qPpQB/9H+WkUtJ70YzXQADFGO1GKT2oAUUtJ70YzQADFGO1fp7+z7/wAEd/2/f2n/AIW6f8Zfg14MGp+HtV3/AGa4a6hiLhGKn5XYHqD2r2n/AIh9f+Cp/T/hXqf+B1v/APF0roD8WRS1+03/ABD6/wDBU/8A6J6v/gdb/wDxdJ/xD6/8FUDx/wAK9X/wOt//AIui67gfiyMUY7V+xPif/ggz/wAFNvBvhy/8WeIvAaW9hptvJdXEpvrchIolLM3D9gDX48yxPDK0En3kJUj3FMBgpa7/AOGnwp+JPxl8V23gf4VaHeeINXu22xWllE00jH6KDgDuTwK/cL4Jf8G2X/BR74s6THrniXT9J8HQSAERardn7Tg/7EKSAfiwNJuwH8/oxRjtX9OOv/8ABq7+3Zp+nSXWheI/DF9OoJETXE8W7HYHyWr8Yv2rP+Cef7Xn7Ft+Lf8AaB8HXek2ckhjh1CMCazlYf3ZUyMkcgNg+1F09gPisUtJ711fgTwT4j+JPjXSfh94Qtzdatrd3DY2cIIBknncIi5PAyxAyaYHKDFGO1ftJH/wb8f8FTZEEi/D1cMMj/Trf/4unf8AEPr/AMFT+n/CvU/8Drf/AOLpXQH4silr9ltR/wCCAv8AwVP06Dzz8N2nA/hivbZj/wCjBXx18dv+Cdn7bH7NWltr3xq+HGsaLpyHDXjQ+bAv1kjLKM+5FF0B8WjFGO1BUqSD+VbPhzw/q/i3X7LwvoEJuL7UZ47e3iXq8srBVUfUnFMDGFLX7Qw/8G/f/BUu4hS4i+HqlXAYf6db9Dz/AH6k/wCIfX/gqgeP+Fer/wCB1v8A/F0roD8WRijHav2hn/4N+v8AgqfBGZP+Fdh8dlvrfJ/8frwb4k/8EgP+CkXwp0ubWvFvwn1k2kClpJLRUugoHU4hZz+lF0B+a4pat6hp1/pN5Jp+qQPbzxMVeOVSrKR1BB5BFUwCTimADFGO1frP8LP+CIX/AAUf+M3w80j4peAPAou9F122jvLKZryCMyQyjKttZwRketfM/wC1v+wB+1D+w7LpFv8AtI6Cmhya6JTZqLiOYuIsbj+7Y4xuHXrSuB8YClr9EP2Wv+CVv7bX7Znw7k+Kn7PvhP8AtnQ4rp7M3DXMUP72MAsAHYHjI56V9K/8Q+v/AAVQPH/CvV/8Drf/AOLouB+LIxRjtX7Tf8Q+v/BU/wD6J6v/AIHW/wD8XR/xD6/8FT+n/CvU/wDA63/+LougPxZFLX7Tf8Q+v/BU/wD6J6v/AIHW/wD8XSf8Q+v/AAVP7/D1f/A63/8Ai6LoD8WRijHavsrwr+wL+0740/afu/2PPDmhLcePbKSaKewE6bUaAbnBkzs4xjr14r7r/wCIef8A4Knf9CHB/wCB8H/xVFwPxKFLiv21/wCIeb/gqd/0IcH/AIHwf/FVm3n/AAb+/wDBVPTFNxH8PBKydBFfW5b8MuKLoD8Wx6UY7V94fHD/AIJk/t4/s7aNN4n+Lnwz1nTtNhGZbtIhcQoPVniLhR7nAr4QZGRjG4wRwQexp3AQUtJ71Nb2811OltbqXkkIVVHJJPagCEYox2r9mvDX/BAX/gqD4p0Cz8Sab4BRbe+hSeMS3sKPtcZG5S2QfY1tH/g3o/4KnDk+A4P/AAPg/wDiqV0B+JYpa7r4n/DfxZ8H/iBq/wAMfHluLXWNCupLO8hDBwk0TbWXcODgjqK4TGaYAMUY7VasLG51K9h0+zUvLcOscajqWY4A/Ov2e07/AIN9f+Co+qWMOo2vgSExTosiZv4AdrDI43UrgfiuKWv21/4h5v8Agqd/0IcH/gfB/wDFVDL/AMG9f/BU+IZ/4QGJs9hf2+f/AEOi6A/E8Yox2r9RPiD/AMEXv+CmXw1spdR174UarcQQglmsTHdnA9onZj+Vfmv4i8MeI/CGrTaD4qsJ9OvbdiksFzG0UiMOoKsAQR9KLgYYpaT3rZ8O6BqvivX7LwxocRnvdRnjtreMdXllYKq/iSBTAxhijHav2ttP+DfD/gqTe2sd5B4DhKSqHXN/ADhuR/FVj/iHn/4Kn/8AQhwf+B8H/wAVSugPxKFLX7a/8Q83/BU7/oQ4P/A+D/4qk/4h5v8Agqf/ANCHB/4Hwf8AxVF0B+JQxRjtX7NeJP8AggR/wU38I+H77xTr/gmCCx06CS5uJDfwYSKJSzH73YA1+XXwj+C3xD+OXxX0v4K/DWyGoeIdZufslpbhgoeXnjccADg8mi4HlQpa/bX/AIh5/wDgqd1/4QOD/wAD4P8A4qvjz9rv/gmt+1t+wzoeleIf2kdAi0W21qZ4LTbdRzNI8YBbhCSAARyaLgfBgxRjtRik9qYCilpPejGaAAYox74oxSUAf//S/lpANHPSjFGMV0AGKOnSj2o4oAADUsET3E6QJyXYKPqaixXsf7PXgC8+Knx28H/DewUtNresWdmoAyf3sqr/AFpAf6n3/BMr4Uj4LfsGfC34fyR+VPaeH7J7gYx+/kjDSH8WJqX9qD/gpN+xb+xp4tsvAn7SHjaDw3quoWwu4LeS3uJi0JYruzDFIByCME5r7H8J6Nb+HvC+n6FaLsjtLaKJR2ARQK/zhP8Ag5C+LS/Ef/gpZr/h63k8228L2Flp6egYxLK4/B3YVkldgf2Nf8P6f+CUfX/hbFp/4A33/wAj0v8Aw/p/4JRn/mrNr/4A33/yPX+XlijGKvkQH+iT/wAFAf8AguT/AME+vF/7GfxF8HfA/wCI0Gr+KtX0eaysLSK0u42ke4xG2GkhVRhGY8sOlfwZfs0fs++Pv2rfjv4e+BXw3hM2q+I7xYEOCViQ8ySNj+FEBY/SvA/av6l/+DVT4Y6L4n/a98Y/ETU0WSfw/oWy2DDlXupACw9DtUj8aduVAf1z/wDBPn/gm7+z9/wT8+E9n4O+G+lQTa7LEh1TWZUDXV3PgbiXPITP3VBwBXzv+2//AMFz/wBiP9h3xlcfDDxbeX3iXxPZ4Fzp+jRLKbdj/DLI7ogPqASR3xX6/eIv7R/sC+OkDN35Enkj1k2nb+uK/wAfX9o6PxxF8ePFyfElLlNcGq3f2wXYYTCXzDndu5zn1qIq71A/0XP2L/8Agv7+w/8AtkfEKy+EumvqXhPxFqT+VZwaxEiRXEnZEkjdxuPYNtz0GTxX68fGH4O/Dj4+fDrVPhb8VNKt9Y0TWIHgnt7hA6lXGMjOcMDypHIIyK/x5/BfiTUPB/i7TPFWkzva3OnXUVzFLGSrI0bBgQRzkYr/AEOPBf8Awcqf8E57Pwhplr4k1bWG1CO1iW5K2DEGUKA3OfWiUOwH8Sn/AAUq/Y7v/wBhr9sDxZ8BGLyadZTi40yZ+TJZ3AEkRJ7kKwVvcGvdP+CHvwrh+LX/AAU0+GejXcRlg029fVXGM4NkhkU/g4WvUP8Agun+21+z3+3d+03ovxZ/Z6luJrG30aOzunuoDA5mSRz0JOQFI5r7S/4NW/hMfFX7ZXiv4o3EeY/C+hiNGI4El6+B/wCOxn86vW1wP9AGSRIY2lfhVGSfYV+VGtf8Fvf+CXXh7VrnQ9X+LFjFdWkjRSp9kvG2uhwRkQEHBHavtn9q/wCJDfB/9mjx38UEO19C0O9vEPT544mK/riv8gbWtQl1XWLrU7glnuJXkYnkksSazjG4H+q98M/+Cun/AATg+L2v2/hfwL8WdGnv7tgsUU/nWm5j0AaeONcnsM5r9AtW0fw/4u0WTS9Yt4NRsLyMq8cqiSKSNxyCDkEEV/jIRTTQSLNAxR1OQQcEGv8AU+/4IteP/HXxL/4JpfC/xV8RZpLjU2sJLcyy8u8NvM8URJPJzGq89+tOUbAfyAf8HDH/AATD8HfsYfFvSvjj8ErL7D4N8cSTB7KMYisr6PBdUA+6jhgyjscgcCvzJ/4JQ/DZfiv/AMFEPhP4Plj8yJtdgupFIyNlqDMf/QK/so/4Ok5tGT9gHR4b7Z9rk8S232cN97iKTfj8MZr+fj/g2P8AhJD49/4KHP41vot8HhXQru6RscLPK0caf+Ol6pP3QP8ARbVVhiC9FQY/AV+Vvjn/AILaf8Ex/hx4x1TwD4x+KNpaaro11LZ3cH2O8fy5oWKuu5YCpwQRkEiv0V+LXiuDwJ8LfEnja6YKmk6Zd3hJ9IImf+lf49fxM8TXfjP4ia74tv3Mk+pX9xcyMepaRyxP61EY3A/1EPAv/BaT/gmJ8RNVi0Tw38W9KFzOwRBdR3FqpJ4+/NEiD8SK/S/Rta0PxTpEGt6DdQ39jdoJIZ4HEkUiN0KspIIPqK/xiVYqcrwa/wBGb/g2V8Z/EXxd/wAE7jb+OJ5rm00vXbu00t5iSRaqsbbVJ/hDs2PypyjZAfOn/Bxx/wAEy/hZ4y+AOoftp/DbTIdK8VeGGjbVmtowi3tpIwTdIFxmRGZcN1wSD0FfweeHNHuvEHiCx0CyQyTX1xHbxqOpeVgoH4k1/qL/APBbvxvovgf/AIJi/FOfWHVTqGnxWUCscb5ZZo8AZ74BP4V/nT/8E4vhrJ8XP26fhb4Fji877T4hs5nTGcpbOJm/DahqovQD/VG/Zo8Cw/DH9nvwX8PoECLo+i2VrgesUSqf5V/DD/wdPfFuLxZ+2t4c+GNjJui8NeH4vOXP3Z7mSRzx7psr/QGtoVt7WOCMABFCgD2Ff5aP/BbP4mp8U/8Agpl8Udcgk8yGz1L+z4yDkbbRFi4/FamGrA/pg/4Iy/8ABT3/AIJt/sdfsFeFPhL8T/iRa6V4lZp77UrVrO7cxz3EhbaWSBlJUYHBI4r9Vf8Ah/T/AMEoz/zVm0/8Ab7/AOR6/wAvLFGMVThfUD/Xs/Zc/bO/Zu/bP8Nah4w/Zs8SR+JdN0u4FpczxwTQqkxUPt/fRxk/KQeARzXoPx2+Pfwn/Zo+GV/8Yvjbq6aF4c0zYLm7kR5AhkYKvyxqznLEDgGvxH/4NoPhO/gD/gnHY+MLiPy5fFmq3t8cjkrFIYFP4iMEVxv/AAdB/FaLwV+wFY/D9JNs/ivXIIgoOCYrVTI36lKi2tgPsr/h/T/wSj/6Kzaf+AN9/wDI9V7v/gvX/wAEqEtJXg+LFqzhSVUWN9yccD/j3r/L6xRjFXyID+wf/ggRPcftP/8ABWD4xftVz5mtGjv7yKQjOH1G63JjPT5Fav7hq/kg/wCDTj4a/wBmfAT4j/FKaIq+q6xDZxyEdUtogSB9Gc1/W8ehNRLcCJ7m3jba7qD6E09JYpRmNgw9jmv8xX/gqp+3b+0Lr/7f/wATpfh1491zTNFtdYmtLW3sr+aGBUtv3fyqrgAHbnivO/2GP+Cm/wC2t8Hf2lfCOpWnj3XdasbnVLa3vNMvryW5guYZXCMpSRmGSDwQMg80+QD/AFJdQ06w1azksNShS4glUq6SKGVlPUEHOa/hb/4OMv8AglF8PfgFb2v7ZX7PmmppWkareC113TrZNsMNxLkpOijhFc8MAAN2PWv7pbC4a8sIbthtMsauR6FhmvyX/wCC69po91/wS0+Kf9tKjRpa2joX7SC7h24981MXqB/lygGv3f8A+CAP7Bc37YP7Ytp448W2jS+D/h+Y9TvWdMxzXQP7iE54OSCzDnheetfhlpOkalr+rW2h6NC9zd3kqwwwxjc7yOcKqgdSSQBX+pd/wR+/Ya0/9hP9jTQPAF/bonibV0Gp65KOWa7mUHZn+7GuFH0z3rWTsgP1KijjhjWKJQqqAAB0AFPr4r/bz/bJ8IfsQ/Atviv4lMct1d39ppun20jY864upAuMDnCpvc/7tfYekX8eraTbapFgrcxJIMdMMM/1rED/ADHf+C9n7P8AF8BP+Ck3jaDTIZI9O8SNFrVs0nRjdoGlK+wl3j8K/GXnpX9yv/B198B9H1H4VfD/APaHsLBf7SsL2XR7q6VTuNvIDLErEcYDbyM+tfw1YxW0XdAfYn/BPr4Yj4x/tr/DH4cSR+bFqXiCzEq4zmKNxI//AI6pr/XBs4FtbSK1QYWNFUD2AxX+at/wbm/CKT4of8FM/DurOm6Dwrp95q7E9NyBYVH5y5/Cv9LGonuAySaKLBlYLn1OKalxBLxG4b2Br+K//g6G/a0+LXw3+Nnw++FPwn8T6l4eWDSZb67/ALOupLYyPNKyLu8thnCoMZ9a/l20X9uz9s/w9fJqOkfFPxTBNGchl1W4/wDi6FC6uB/rukKwwRkV+Z3/AAUE/wCCWH7Mv7f/AIAu9L8daRBp3idIm/s/XbWMJdQS4+XcwxvTPVGyPTB5r8Kf+CBv/Baj4vfHz4nJ+x/+1TqQ1rULu3ebQ9XmAFxI8Iy0EpAG8lfmVj83ByTxX9hFS9GB/kB/tZ/svfEz9jz47698BPirbeRqeizmMSLny54TzHKhxyrqQw+vPNe7f8EqPhavxh/4KEfCrwbKnmRjXra9kUjIK2TeeQfY+XX9MP8Awdffs3adP4Z8AftSaVAqXcU76FfOo5dWDSwkn2w4/KvzD/4NkPhMnj3/AIKIjxrcRhovCOjXV4CRnEs+IV/RmrW+lwP9F6JEiiWOMYVQAAPQUkk0UWBKwXPqcVJX8Mf/AAc3ftdfGXwH+1r4W+Ffwr8Wan4ft9M0Jbm4j027ktg8tzIxy4jYZIVVxmskrgf3KfbLT/nov5ij7Zan/lov5iv8hP8A4bQ/a6/6Kb4n/wDBpcf/ABdH/DaH7XQ4/wCFm+J//Bpcf/F1fs/MD/Tg/wCCrnxjtPgz/wAE9Pir4zSZVmfQrmxhIOT5l8vkKR7gvmv4b/8Ag3L+Fo+J/wDwU00LXb9PMi8N6fe6qSeR5oCxL/6MJ/CvyI8X/tOftF/EHQZvCvjnxzrusabcYMtreX800L7TkbkdyDg8jiv6mv8Ag00+En274g/E/wCM93H8tlaWWm2zkfxStI8gz9FSi1kB/cDX8MP/AAdl/EhtQ+NPw0+FcMgKabpNxfSIDnD3MpUHHusYr+56v8zb/g4b+K83xP8A+CnHjK3SXzLXQIbPTIVHIQwQoJB/383GlDcD8O8UdOlHtRxWoAAaOelGKMYoAMUUe1H0oA//0/5aRS0nvRjNdAAMUoUk7R1NJivRPhB4h8LeEviz4X8VeObNtR0TTNXsrvULVMbp7WGZHljGeMugKjPrQB+8f7E3/BuF+1l+1b8ObH4s+N9Xs/AGj6rEs9lHfQvPdyxNyrmIMmwEdNxz7V+wn7G3/Bsz4l/Zl/ad8G/HvxN8SbPXbPwtqCXzWMenvE0rIp2jcZWAwxB6dq2tK/4OrP2UNF0yDSdO+HWuRwW0axRqJoQAqjAHT0r9RP8Agmt/wWD+GH/BS7xb4i8LfDXwrqOiDw5bwz3E95IjqfOLBVAUdflJrJuQH7B4GNoFfyK/tc/8G0fxI/aj/aQ8YfHy6+K1nYnxPqU96lu2nPI0UcjEqhbzhnaMDOB0r+pz40/FTQfgf8JfEfxf8Uqzaf4b0+fUJ0QgMyQIW2gnjJxge5r+ZiT/AIOvf2XEkMY+H2unBIz50X+FKN+gHx6P+DSXx6OP+Fv2X/grf/4/Tv8AiEl8d/8ARXrL/wAFj/8Ax6vr3/iK/wD2XOv/AAr3Xf8Av9F/hTJf+Drz9l542Rfh7roJBGfOi/wqveA/jN/bK/Z0t/2TP2lPFf7PEOtx+IX8K3r2Mt9HEYVeWPhwFLNja2R1Nfo5/wAEFf25/B37En7aEV38T7n7H4Y8YWv9kXtyxwlu7MGilf0UMNpPYMT2r8sP2kPi3L8evj14v+M88bRN4n1W61Io5yy/aJC+CfbNeJgkHg/Sr3QH+z1o2taV4i0q31zQ7iO7s7uNZYZomDI6OMhgRwQR0Ir8uf23f+CNf7E37deoS+K/iRoLaR4mkTa2s6Swt7l/QuMGOQj1dCa/g3/Yi/4LS/tt/sO21t4Y8F66Ne8L2/C6Nq4ae3RT1EZyHj/4C2Pav6XP2a/+Dqn9n/xjLa6J+0j4Mv8AwrcOVSS+0+QXtvk9WMZCOij2Lms3FrYD4f8A2lP+DU34ueF7C6139mXxxb+IRFuaPTtVi+zzsvoJkJQt9UUfSv5iP2gP2bfjb+y54/ufhj8dvD134d1i2JHlXKYWRR/FG/3XQ9mUkGv9b74IfHr4Q/tIeALT4n/BPXrXxDod4P3dzavuAPdWHVWHdSARXwh/wVp/YC+GX7c37K3iHSdcsIh4p0Kynv8ARNQVB50NxCu/ZnqUkC7SM9wewpqb6gf5X4r+7L/g0++EraR8AviH8Y7mPY+r6xHp8TEfejtYlfI9t0rD8K/hZ1Gxm0y/n065GJLeRo2Hupwa/wBNL/g32+F0nw0/4Ji+BprqLybjXjdanIMYJE0rbCfqgWnPYD6C/wCCvXhz4t+N/wDgn74++H/wQ0S68QeIfEFtHp8NpaLukKSuPMOOOAgOfrX+eYP+CPH/AAUsJ2j4Ra7k8f6of41/p6fGH9pL4B/s/LZN8bvF2l+FhqO/7L/aVytv53l43bNxGcZGfrXhp/4KU/sCY/5K94W/8GMX+NRFtbAfwr/slf8ABuj+3j8bPHmnw/GTRB4C8MCVWvbu9lje48oHlY4kJO4jgFsAdeelf6G/wW+EvhP4E/Cfw/8AB/wND5Gk+HbGGxtlPXZCoUE9OTjJ96+GfiF/wWO/4JrfDbTpdR1n4saLd+UpbyrCQ3UrY7BYw3Nfzcf8FHf+Dmy68eeGL/4T/sNafc6RFeo0M/iK+AS5Ctwfs8SkhDj+NmJ54AIzTd2B4X/wc5ftz+HPjf8AHTQ/2XPh7ei707wF5suoyxMDG2oXGAyZBwfLRVHsxYV9ff8ABpf8I5IdF+KfxsvE+S4lsdKtmI6GISSSAH33p+Vfxaarqmpa5qU+savM9zdXTtJLLISzO7HJJPck1/o3/wDBtL8LpPAP/BNzTvEVzGUl8T6reagCeCY9wiU/TCZFVLSNgP1W/by8E/Ff4l/se/ED4dfA+1S88U67pMthYxSSLCrNcEI+XbgYjLGv4EH/AODcD/gqXI7OfCumksc/8hOHrX96f7af7fv7OX7AvhPS/Gf7RN/c2dprNybW1FpB58jOq7j8uRwB1Oe4r86Lb/g5H/4Jf3E6wnXtYj3HG5tOOB9cOT+lQm1sB/OT+z7/AMGvH7bHjfxXbR/HbUdL8HaIrg3EkUwvbkpnkIqYUEjuWwPQ1/bZ8Gfhf+z7/wAE9P2ZNL+HWn31t4d8I+FLXbJeX8yxKTyXkkdtoLOck+prvv2dv2mPgj+1f8Obf4rfAXXoPEGi3DFPOhyGSQdUdThkYZGQR3r+bf8A4OWf2GfF/i74Jn9rbwJ4h1aSLw/Ikeq6LJcvJZC3lO0TxRk4jKtgMAMEEHAwSS93Zgfj1/wXn/4LAaF+3D4ls/gD8AJ5H+H3h64M8t2cr/aV2oKh9p6RoCQnc5ye1eaf8G2Xwti+IH/BSjSfEU8fmL4V0u81IZGQHZRAD/5FNfgD71/ZP/waX/ChJ/EfxS+NNxH81vFaaRC+P7+ZZBn8ErR6ID+0Pxj4htfCXhPU/FN8QsOm2st1IW6BYlLHP4Cv8ev46eL7zx/8ZvFHjS/kMs2qapdXDOerGSRj/Wv9Tj/gqb8Ux8HP+CfnxV8Zq/lyf2BdWcbDqHvFMCke4L1/k6zSvPM0shyzkkn3NTACMVJFG0sixpyWIAHuaj969e/Z/wDBcnxG+Ong7wFGm86xrVjZleuRNMin9Ca0A/1Qf+CZHwy/4VF+wT8LPBEkPkyw+H7KWZMYIlmjEj599zHNfy9/8HZ/xSjuvG/wv+DMUnz2lldatIgP/Pw/lLx/2yNf2oeEdHt/D3hXTdCtV2RWdtFCqjgAIoAH6V/nD/8ABxx8SZ/iV/wU213wvav56+HLKy0uJV5wSglIHvukP41lHVgfk7+zR+yN+0P+174z/wCEE/Z68MXfiK+QBpTCuIYVPQyyNhEB7biM9q/Wmy/4Nrf+Cnl1bJPNoWkQMwBKPqUeR9cAiv7V/wDglF+x38Pf2Jv2PfC3gPTYLaLXr+0jv9aulx5k95MoLZbqQvCqOwFfpeNR09jtWePJ9GFDm+gH5ff8EdP2NPGv7DP7EWhfBT4mwQQ+JUury71D7O4lQvPM7L8w64QqPwr9OddOpDRbs6Ooe8EL+QpOA0gB2jPbJrV4NRyzRQpvmYIvqTgVDA/zr/iR/wAG6H/BT3xx8QNa8YzaTo8japez3RZtSTJ81y3PHvX6Lf8ABMb/AINt/iv8Kvjrofx3/a+1OwS28N3KXtpo1g5nM9xEcoZZCAoVW52qCSQOe1f2Yf2npv8Az8R/99CuY8V/Ej4feBdLk1zxnrdjpVnECXmup0iRQO5LECq5mB2aqqKI1HAGB9K/lM/4Ojf2wtC8E/s8aP8Asj+H75W1zxZcx32oQI2THY25ym/03ygED/Zr6h/b9/4OGv2Rf2Y/DV74c+BGoQ/ETxk0bLbx2L5sIJDwGlnHDY67UznpkV/A98W/i58d/wBun9oqXxn43uZ/EHi/xffR28MajOZJmCRRRr/Cq5CqBwBTjHqB+0n/AAbifsDn9pf9qc/tBeN7IT+FPh26ToJFzHPqR5iXng+VxIfQ7a/0TwFjTAwAo/DivgP/AIJmfsa+Hv2G/wBkTwv8FtNjX+0lgW71afADTXs4DSE/7p+Uf7IFXP8AgpP+1lbfsbfskeJvixaHzNdki+waJbqN7z6jcgrCqr1ODliPQUm7sD+Mf/g4+/bzk+Of7Xtl8AfA98JfDvw0k8uUxHKyamSPOJPfy8bB7g+tf3M/sd+P1+Kf7Kvw7+Iqtk614e0+7P1lgVj/ADr+Rf8A4JTf8EDfHXxq8aR/tbf8FBrWaCzvbg6hbeH7nIuLyWRi/mXefupnny+rfxY6H+2fRtG0vw9pNtoWhwJa2dpGsMMMY2okaDAUAdAB0pytsgPyG/4LxfBGT44f8E0fHmn2USyXugpDrMBb+H7G+6Qjkc+Vvr/L/Ix1r/Yo/aG+GNt8aPgV4w+E90iuviLR7zTwHGVDXETIpP0JBr/IF+IPha98E+OtX8H6ihjn028mtnXHRomKn+VODA/rV/4NM/hW+ofEr4ofF+4iwunWVlp0Mh7m4aR5APpsXP1r+4j61/M5/wAGt/wri8I/sI6t8Q5Yttx4n164cP8A3orZVjX9Q1f0sahdxWNjNezHCQozsTxwoyamW4H+aR/wcQfFn/hZ3/BTXxfY20nmWnh2Cz0yIZzhooVMg/7+Fq/DWvqv9uX4mD4w/tf/ABH+JEb+ZFqviC/miP8A0zMzbfyGK+U8ZrVaID9Gf+CR+panpf8AwUi+D8+klhI/iG3jbH9x8hh+RNf6uY9+tf5p3/Bu3+zrqvxu/wCCi+geLfJZtL8DwTavcyY+USY8uFScYBZmJH+6a/0sqznuB/OT/wAHPUVtJ/wTtgeb76eIrMp9dkv9K/PL/g0t+FFwIPip8a5o/wB08lpo8T4/ijUzOPykWvcP+Drv41afon7P/gH4FQSD7brWqvqkiDqILVDGM/VpD+VfX3/BtB8Ln8C/8E3rDxZLGYn8V6te35yMEiJ/s4P5RCj7IH9Cpr8TP21v+CFH7K/7dnx1vfj98Xdd8QW+rXsMNuYbGeFIEjgUKoUPCx7ZPJ5r9pNW1Sx0XTLjV9TcRW9rG0srnoqIMk/gK/EW9/4OJv8AgmBYXkthceKtREkLsjY0+QjKnB71Kv0A+YP+IV/9gYf8zF4r/wDAm3/+R6P+IV79gb/oYvFf/gTb/wDyPX0r/wARGX/BLrr/AMJVqP8A4LpP8aD/AMHGP/BLs8DxVqP/AILpP8aq8gP4Zf8Agqz+y38H/wBjP9s3xD+zx8Fry9vdL0GO2V5b+RJJfNliWRgSioON2MYr+xj/AINdvhVL4M/YH1Dx7dx7ZPFGvXM0bEYLQwKkQ/8AHlav4e/26vjpZftLftdePvjfpUrzWXiHV7i4tGcbWNuWIi4PTCADFf6Uv/BHT4af8Kq/4JufCnwzLEYZpdFhvJlPB33X70k/99U5bAfpPqV5Hp+nT385wkEbSMT2CjP9K/yJf23PihJ8aP2ufiP8UXcsmteIb+6jz2jeZio/AcV/qn/tmfEiD4Q/so/EP4k3L+WNJ0C+mU9Pn8plQfixAr/IZ1W7k1DVLm+lJLTSu5J6ksc0QAoDFGO1GKT2rQBRS0nvRjNAAMUY98UYpKAP/9T+WkA0c9KMUYxXQAYo6dKPajigAANf3gf8Gn/wnh0T9nP4g/GGWP8Afa9rEVgrY5MdlHnr/vStX8H+M1/pw/8ABvx8KJPhZ/wTF8DPcR+XP4h8/WHyMEi6csh/7421E9gNT/gvp8VJPhf/AMExPH4tZfJuNeW20uI55JlmRmA+qIwr/MLJP51/ri/tufsQfB/9vj4T2/wa+NzXo0a3vo9Q2WU5gZpYldF3MvJGHPHrX5L/APEMP/wTc/54a7/4MZKmMkkB/nQgGjnpX+i//wAQw/8AwTb/AOeOu/8AgxkrF8Rf8G0H/BNDw7oF7r9+muRQWUEk8jtqMmFWNSST+AqudAfxA/8ABP8A/Zy8J/ta/tfeCf2d/G+ozaVpvii8ktpbm22+am2J5Bt3AjJKgciv7Dh/waefsp4/5KF4k/75t/8A43X8Wvwy+LQ/Z1/ag0n4wfDIPHH4V1xbyyR2JYxQyfdJPJ3JlT9a/wBWb9kX9qr4T/ti/A7RfjX8JNSivbPUbdGniDDzbafaN8Uqgkq6ngg/UZFEm0B/lo/t7fss3/7GX7V/jD9nm4M8ltoN4Us57gAPPauA8UhwACWQgnAxXx5z0r/UX/4KVf8ABHP9nH/gpCtr4l8XSTeHPF1hH5MOs2CqZHiGcJKrDbIoJ4zgjsa/E/w1/wAGk/hWHXo5fFvxaup9NDZeO2sEjmK+m5ncD/vmhTQHl/8Awaba98T5PG/xN8PRy3D+Eo7WzleNixgS7ZpApUdAxUHdjnAGe1f2d/FHX9O8K/DTxB4m1h1jtNP026uJmboEjjZmz+ArwT9jb9i34EfsJ/B+D4P/AAK00WNih826uJTvnupsAGSVzyWOPoOgAFfz5f8ABwR/wWA8C/D34War+xh+z3q8epeKNfQ22u3lm+6Oxtc/PDvXgyyY2sAflXIPJwI3YH8N3jOdfE/xH1S501Rtv9QmMSr0/eSHGPzr/XB/Y6+H9v8ACv8AZX+H/wAPraPy10rQrGDbjGCsS5/Wv8rP9hr4aH4x/ti/DX4eSJ5sep+I9PWdMZ3QrOrSf+OA1/ro6ZZw6bpsGn24xHBGsa/RRgVU2B/Bn/wdZ/FJ9a/ao8EfCy2n3R6JoZu2RT92S7kYHPvtRa/lQ86YdGb86/Yb/gvN8UH+KH/BTz4jTCTzIdGuY9Ki9AtqioQP+BA1+OvFWloAuWbluaTnpRijGKYD40LyKnqcfnX+tB/wTN+GX/CoP2Dvhb4AeHyJbLw/ZiVcYPmNGGYn3yTX+WD+zt8Pz8V/jz4O+Garu/t7WLOxx6ieVUP86/2CfCulwaH4Y0/R7dQkdrbRRKoGAAigVnMD+J7/AIO0PiUt58Rvhb8J4Hz9isLvUZUz0M7hFOPpGa/jy56V+9X/AAce/FF/iJ/wUw8RaPHKJLfw7Y2WnRqDnayRBnH/AH2xr8FcYqo7Af2Kf8Gl3xB14ePPir8MpJ3bTfsdhqCQ7sosxaRGYD1KqoP0r+o//gpv4dtPFX/BP74uaNeoHR/DN84BHRo0Lg/gRX8jH/Bp5fxQ/tP/ABI09iA8+hWrKPZJXz/MV/ZT+3JoV54m/Y5+J2g6ehknuvDWpJGo6sxgfA/GoluB/kOyJtkZR0BIr/RE/wCDX/4RzeBf+Cfc/wAQbqMpJ4v1u7uRkclLY/Zx/wCiyfxr/PDuYJFv5Lcj5xIVx3znFf6s/wDwSR+Fj/CD/gnX8KfCc0XkzSaFbXsydxLdqJnz77nNVPYD89v+Dmn4tnwB/wAE6pfBVu5WbxfrFrZ4HeOEmZv1Vfzr/OW6dK/tI/4O0vitAX+FfwVgk/eql3rEqZ/hkIhQkfVGr+LfinDYAANfrH/wRB+E0fxe/wCCmXwz0i8j8y00y9l1KcYzgWsLuh/7+bK/JzFf1H/8GrPwik8U/tjeLPircx7rfw3oDQKccCe8lTaf++Y2/Om9gP7+ZHSCFnbhUGSfYV/kh/8ABQb4o3Xxd/bZ+JXxHaUub7xBeNG2eiJIVTH0UDFf6pP7UnxGi+EX7N3jv4myMEbQ9B1C8jJ7yQwOyD8WAFf5A3ibV5vEHiO/125JaS8uJJmJ65dif61nADv4/j38a40EcfinVAoGABdScAfjX1V+w/4v+OPxn/a8+HHwxXxNqk6atr9lFIhuZCDEsgeTPP8AcU1+fWK/cf8A4N3/AIWyfEn/AIKceE74R708NWl5qznGcBE8kH85RWj7gf6XtjD9msobf/nmirn6DFfzjf8ABzd8ePEPwj/Yh0Xwt4S1CXTr/wAT67HF5kEhjk8q2QuwBBz1K1/SFX8QP/B2b8XY7z4i/DH4IW75+w6fcavMB2a4kMSg/hF+tZR3A/lMPx8+NjqVbxVqhB4/4+pP8a43WPHHjPxC5fXNUu7snjMsrN/M1yuKMYrUBWLMctya/qZ/4Nmf2BR8ZvjveftdfECx8zQPBDGHS/MHyS6k6/eA7iJGz/vEdxX80vwp+Gvin4yfEnQ/hX4Itmu9W1+9hsraJASS8zBR68DqT2AzX+sV+wb+yh4S/Yt/Zb8KfATwrEgOlWiG8mVdpnu5Pmmkb3ZyT7Dipk7ID7D6DFebeNfhD8OviL4g0bxN430uDVLrw/I82n/aF8xIJZMAyKp434GA2MgZx1Nek1+dX7cH/BUb9kn9gzw3Ne/FzxDFc65sJt9EsWWa+lOOMoDiMH+85UemayQH3x4j8S+HPBmg3PiTxReQabp1jG0s9xcOI4o40GSWYkAACvk39kL9u34F/tvN4uvPgPdyahpvhLU/7MkvGXZHcPsVy8Y67OcAkAnGcV/nu/8ABSr/AILV/tL/APBQTU5vCiTv4U8Bo+YdEspCBKAeGuHGDI3sflHYV+zn/BpX8Ro0v/iv8K5n+aQWWpxoT1wGjc/otW46Af2qnkYr/LK/4LXfC63+FX/BTL4oeHrCIRW95qf2+NVXAxdospx+LGv9TWv4G/8Ag5T/AGeLvUP+Cj/gbUtAiPmePdMsrbIH3rlZ2g/H5dlENwP6rP8Agjh8LY/hF/wTc+Ffhny/Lmn0aG+nGMfvbr9636tX1f8AtdeOD8Nv2XPiD46UlX03w/qEqYGTv8lgmMd9xGK9I+E3hKx8B/DLQPBumJ5cGm2FvbovoI0AAruL2xs9RtXstQiSaGUbXjkAZWHoQeKnqB/jXap4c8Y6vq9zfNpl3I88rucQuSSxznpX1D+zT/wTz/bA/ay8WW/hT4PeCNSuhM4WS8uIHt7SEHgs8rgLgdcDJ9Aa/wBYFPhj8OY23R6Fp6n2t4//AImuqsdL03S4/J023jt0HaNQo/Sq5wPy3/4JOf8ABMzwb/wTb+A//CJRyx6l4t1spca3qSrgSSAfLGnfy48naD3JPev1B13XNJ8NaLdeIdeuEtbKyieeeaQ7UjjjGWYk8AACuD+Lfxs+E3wI8I3Hjr4v+ILHw9pVspZ572ZYl4GcKCcs3oqgk9q/hd/4LLf8F87v9qTSL/8AZp/ZOkn07wRK3l6lqzAxT6kqn7ijqkJPPOGbvjpSSbYH5pf8FmP26W/bz/bS1jxj4bmaXwtoJ/sjQ1IwGt4GIMgH/TV8vzzg4r/Q3/4JnfDOH4RfsGfC3wNHF5LW/h+zllXGD5syCRyfcsxzX+V1+z94Em+KHx18HfDuJS51vWrGyYd9s8yox/AHNf7BHgvQrfwx4Q0vw5ZqEisbWKBAOgEagD+VVPsB8sf8FD/iC3wv/Yg+KPjWEuJrXw7fLB5YJbzpYyiYxz95hX+TReeG/Fd3dSXTabdZlYuf3T9T+Ff7LGoadYaraPYanAlxBIMNHIoZT9QeDXIH4XfDb/oAaf8A+A0f/wATUqVgP8c0eEvFR/5ht1/35b/Cj/hE/FWP+Qbdf9+X/wAK/wBjL/hV3w2/6AGn/wDgNH/8TWfq/wAP/hdpGk3WrXehacsVrE8rsbeMAKgLE/d9BVc4H+Pz8OPBF/46+JWh/D2KNluNX1C3sVQjDbp5AgGPXJr/AGF/hf4asvB3w50Lwrp8Yhg0+wggRFGAoRAMV/mj/sM+FIf2pP8AgtB4fmEam3uvGc+ssqDCCO0la4HA7fIBX+ngiLGgRBgAYA9qUwPyE/4LpXvjlv8Agm7428KfDvS73V9T8Qm205LewheeUq8okY7UBOMJya/zgP8Ahjr9rDp/wrfxL/4K7j/4iv8AX4kiimXZKoYehGRUH2Cx/wCeMf8A3yP8KSlYD/IN/wCGOv2r/wDom/iX/wAFdx/8RQ37Hv7VqKWb4ceJQByT/ZlwP/ZK/wBfP7BY/wDPCP8A75H+FfNf7Y3jey+EX7KvxC+JiLHC+i6Bf3UbYAw8cTFfxziq52B/kIAGjnpRijGK0AMUUe1H0oA//9X+WkUtJ70YzXQADFGO1GKT2oAcp2kMO1f0OfA7/g5E/bG+APwi8PfBnwX4a8MnSvDVjDYWplgnLmOBQoLYnAJwOcAV/PF70YzSaXUD+nH/AIio/wBu/ofDXhX/AMB7j/5Ipf8AiKj/AG8Dx/wjXhX/AMB7j/4/X8xuKT2pcqA/pzH/AAdSft3/APQs+Ff/AAHuP/kiuE+KP/BzL+3B8U/hxrnw21XQvDdpba9Yz2Es1vBOsqJOhRmQmcgMAeOK/nI96MZo5UBJJI0srSufmckk/Wvrr9kn9uv9p79iXxcPFn7Pfie40cyEG4tDiW1uB6SQuCh+uMjsa+QcUntTYH9d/wAIP+Dsb4z6NpsVj8afhvpetSxjBuNOnktHf3ZXMq5+gA9q9Y8Vf8HbMraey+C/hEkd2R8rXuoGSMH3VI0J/Aiv4ufejGaXKgP3H/ay/wCDgj/goD+1Ho9z4SttZt/BOi3eVltdBjMDOp7GZ2ebGOoDgGvxDvr6+1S7kv8AUZnnnmYs8kjFmZj1JJ5Jqpik9qaVtgPof9lT9o3xV+yV8evD/wC0F4IsrTUdV8OyvNbQXys8DO6NHlgjKTgNkYI5Ar97B/wdRft3Af8AIs+Ff/Ae4/8Akiv5jfejGaGkB6f8aPiz4n+O3xW1/wCMHjUp/aviO+mv7rywQgknYswUEkgAnjmvMMdqMUntTAUUtJ70YzQB7L+z18adc/Z0+NPhv43+GLO2v9S8M3sd/bQ3is0DSxHK7grKSAeeCK/oN/4io/278bR4Z8Kj/t3uP/kiv5jcUntSauB7f+0f8evGf7T3xu8SfHn4gCJNW8T30t9cRwAiJGlYnagYkhV6AEnivEqT3oxmmB91fsB/t/fF/wD4J3/Fi9+LnwctbG9vtQsWsJodRR3hMbMGzhHQ7gRxz3Nfr7qH/B0r+3LqtjNpt94W8JyQ3CNG6Nb3BBVhggg3FfzMYpPak0mB0mq+IF1PxVP4nS1itxPcm4+zx58pctu2jJJ29uua/ow8Kf8ABz/+234N8Maf4T0Xwv4VS0023itoV+z3HCRKFA/1/oK/ms96MZoaXUD7q/b7/b/+MH/BRH4sWPxd+MtrY2V/p9gmnwxWCOkKxIzP0d3OSznPNfCuO1GKT2osAor9Qv8Agnd/wVX+OX/BNi08RwfBfR9H1B/EzwNcyanHK7L5AIUL5ciYHzEnrX5e+9GM0MD+gP8AaP8A+Di/9sz9pj4JeIfgX4t0Xw9Y6b4ktTaXE9nDOk6xsQTtLTMBkDByDwa/n95J+tJik9qErbAKK+9f2Av+CgvxY/4J2/EjU/in8HdN02/1PU7I2DtqUbyKkRZXO3Y6YJKjP0r4K96MZoYH9M3/ABFOft7dDoHhf/wGn/8Aj1fjZ+3V+3R8Xf8AgoD8Y0+NHxjhs7bUYrSKyjisUZIUjizjAZmOSSSea+LMUntRyoBRS0nvRjNMD6u/Yy/a08WfsUfG+y+PXgPSNN1fWdNikjtF1SN5IoXlG0yKFZDvC5UHPQmv25H/AAdN/t7dP7A8L/8AgNN/8er+ZjFJ7UmkwP3++O3/AAchf8FEfjR4Hm8EaTfab4QW6BSa60aApcsh7CSRpCn1TB96/CfxZ4x8V+O9cn8TeNNRuNU1C6YvNcXUjSyOx6ksxJP51zXvRjNCSQAMV93/ALAf/BQX4zf8E7PihqPxU+C8Fld3uqWB0+aHUEZ4jGXV84RlO4FeOfWvhDFJ7UwP6aP+Ipz9vbH/ACAPC/8A4DT/APx6vg79qv8A4LH/ALQ37XvxX+Hvxh+JuiaHHqfw4vhf2C20MqxzMHRwsoaQkqGToCOpr8ifejGanlQH9Mcf/B0x+3nEixJoHhcKowP9Gn6f9/qk/wCIpz9vc8f2B4X/APAab/49X8zGKT2o5UB/TM//AAdNft7uhVdC8MKT3FtNn/0dXiXxI/4OSP8Agpf45sZbHRNe07w4sy7S1hYRFgD1w0wkIPuDmvwH96MZp8qA91+M37Tn7QH7Q2rnW/jX4v1TxJcMSQb65eVVz12qTtX6ACvCsdqMUntTA9f+Afxj1z9n34xeHvjR4Ztbe91Dw5dpe20N2paFpY+V3BSpIB54I5r+ghf+Dpr9vVFAGgeF8D/p2n/+PV/Mz70YzSaT3A/pm/4inP29uh0Dwv8A+A0//wAepf8AiKc/b3PH9geF/wDwGm/+PV/Mxik9qXKgP6aP+Ipz9vbH/IA8L/8AgNP/APHq5Tx5/wAHN/7dnj3wPrPga/0fw5bQa1Y3FjJLDbzCRFuIzGzITMQGAbIOOtfzh+9GM0cqA+u/2M/2yPiJ+xN8fbb9or4c2VjqGu2sU8UY1BGeIfaBhmwrKc4z371+1g/4Om/29+n9g+F//Aab/wCPV/Mxik9qbSYH9NH/ABFOft7Y/wCQB4X/APAaf/49R/xFN/t7df7A8L/+A0//AMer+Zj3oxmlyoD+mb/iKc/b26HQPC//AIDT/wDx6vA/2n/+Dhf9s79qr4GeIPgF410zQrDSvEcAt7mWyhlScR7gxClpWAzjB4PFfgrik9qOVAKKWk96MZqgAYox74oxSUAf/9b+WkA0c9KMUYxXQAYo6dKPajigAANHPSjFGMUAGKOnSj2o4oAADRz0oxRjFABijp0o9qOKAAA0c9KMUYxQAYo6dKPajigAANHPSjFGMUAGKOnSj2o4oAADRz0oxRjFABijp0o9qOKAAA0c9KMUYxQAYo6dKPajigAANHPSjFGMUAGKOnSj2o4oAADRz0oxRjFABijp0o9qOKAAA0c9KMUYxQAYo6dKPajigAANHPSjFGMUAGKOnSj2o4oAADRz0oxRjFABijp0o9qOKAAA0c9KMUYxQAYo6dKPajigAANHPSjFGMUAGKOnSj2o4oAADRz0oxRjFABijp0o9qOKAAA0c9KMUYxQAYo6dKPajigAANHPSjFGMUAGKOnSj2o4oAADRz0oxRjFABiij2o+lAH/1/5aRS0nvRjNdAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY7UYpPagBRS0nvRjNAAMUY98UYpKAP/0P5aBzRntQOtJXQAvanegpvandxQwGjmjPagdaSgBe1O9BTe1O7ihgNHNGe1A60lAC9qd6Cm9qd3FDAaOaM9qB1pKAF7U70FN7U7uKGA0c0Z7UDrSUAL2p3oKb2p3cUMBo5oz2oHWkoAXtTvQU3tTu4oYDRzRntQOtJQAvanegpvandxQwGjmjPagdaSgBe1O9BTe1O7ihgNHNGe1A60lAC9qd6Cm9qd3FDAaOaM9qB1pKAF7U70FN7U7uKGA0c0Z7UDrSUAL2p3oKb2p3cUMBo5oz2oHWkoAXtTvQU3tTu4oYDRzRntQOtJQAvanegpvandxQwGjmjPagdaSgBe1O9BTe1O7ihgNHNGe1A60lAC9qd6Cm9qd3FDAaOaM9qB1pKAF7U70FN7U7uKGA0c0Z7UDrSUAL2p3oKb2p3cUMBo5oz2oHWkoAXtSngUnalPQUAf/9k=";

// ==================== INITIAL DATA ====================
const INITIAL_CLUBS = [];

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const URGENCY_COLORS = { Urgent: "#EF4444", Normal: "#F59E0B", Bas: "#6B7280" };
const STATUS_TYPES = ["À faire", "En cours", "Terminé"];
let CURRENT_USER_ID = 1;

const DEFAULT_THEME = { primary: "#0F56B8", sidebar: "#2D2D30", sidebarText: "#F4F2EF", accent: "#FEB601", background: "#F4F2EF", cardBg: "#ffffff", textMain: "#2D2D30", textSecondary: "#6B7280" };

const initialUsers = [
  { id: 1, firstName: "Mélissa", lastName: "Dupont", email: "melissa@espritpadel.com", phone: "06 12 34 56 78", role: "Responsable Communication", clubs: [], avatar: "MD", admin: true, daysOff: { Lundi: false, Mardi: false, Mercredi: true, Jeudi: false, Vendredi: false, Samedi: true, Dimanche: true }, vacations: [], password: "", passwordLog: [], theme: { ...DEFAULT_THEME } },
];

const initialObjectives = [];

const initialTasks = [];


const initialMeetings = [];

const initialSlots = [];

const initialProjects = [];

const initialPublications = [];

const initialFolders = [];

const initialDocuments = [];

const initialPhotoAlbums = [];

const initialPhotos = [];

const initialCalendarEvents = [];

const initialTournaments = [];

// Weights for scoring (matching Esprit Padel model)
const SCORE_WEIGHTS = { engagement: 0.30, croissance: 0.25, visibilite: 0.20, regularite: 0.15, efficacite: 0.10 };

const initialReportingData = {};

const instagramPosts = [];

// ==================== HELPER COMPONENTS ====================
const uid = () => String(Date.now()) + String(Math.random()).slice(2, 8);

// PDF download helper - opens in iframe and triggers print dialog
// Upload file to Firebase Storage and return download URL
// Generate .ics file and trigger download
function downloadICS(title, date, time, endTime, description, location) {
  const d = date.replace(/-/g, "");
  const t = (time || "09:00").replace(":", "") + "00";
  const et = (endTime || (() => { const h = parseInt(time || "09") + 1; return String(h).padStart(2, "0") + ":" + (time || "09:00").split(":")[1]; })()).replace(":", "") + "00";
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EspritPadel//FR",
    "BEGIN:VEVENT",
    `DTSTART:${d}T${t}`, `DTEND:${d}T${et}`,
    `SUMMARY:${(title || "").replace(/[,;]/g, " ")}`,
    `DESCRIPTION:${(description || "").replace(/\n/g, "\\n").replace(/[,;]/g, " ")}`,
    `LOCATION:${(location || "").replace(/[,;]/g, " ")}`,
    `DTSTAMP:${now}`, `UID:${uid()}@espritpadel`,
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", `DESCRIPTION:${title}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(title || "event").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30)}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadMultiICS(events) {
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const vevents = events.map(ev => {
    const d = (ev.date || "").replace(/-/g, "");
    const t = (ev.time || "09:00").replace(":", "") + "00";
    const h = parseInt(ev.time || "09") + 1;
    const et = String(h).padStart(2, "0") + (ev.time || "09:00").slice(2).replace(":", "") + "00";
    return [
      "BEGIN:VEVENT",
      `DTSTART:${d}T${t}`, `DTEND:${d}T${et}`,
      `SUMMARY:${(ev.title || "").replace(/[,;]/g, " ")}`,
      `DTSTAMP:${now}`, `UID:${ev.id || uid()}@espritpadel`,
      "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", `DESCRIPTION:${ev.title}`, "END:VALARM",
      "END:VEVENT"
    ].join("\r\n");
  }).join("\r\n");
  const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//EspritPadel//FR\r\n${vevents}\r\nEND:VCALENDAR`;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "esprit_padel_calendrier.ics";
  a.click();
}

const uploadToStorage = async (file, path) => {
  if (!_fb_ready || !_fb_storage) return URL.createObjectURL(file);
  try {
    const fileRef = storageRef(_fb_storage, path || `uploads/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    return url;
  } catch (e) {
    console.error("Upload error:", e);
    return URL.createObjectURL(file);
  }
};

const downloadAsPdf = (html, filename) => {
  const printWindow = document.createElement("iframe");
  printWindow.style.position = "fixed";
  printWindow.style.right = "0";
  printWindow.style.bottom = "0";
  printWindow.style.width = "0";
  printWindow.style.height = "0";
  printWindow.style.border = "0";
  document.body.appendChild(printWindow);
  printWindow.contentDocument.write(html);
  printWindow.contentDocument.close();
  setTimeout(() => {
    printWindow.contentWindow.focus();
    printWindow.contentWindow.print();
    setTimeout(() => document.body.removeChild(printWindow), 1000);
  }, 500);
};

// ==================== SYNC HOOK ====================
function useSyncState(key, initialValue) {
  const [value, setValue] = useState(() => {
    if (!key) return initialValue;
    try { const s = localStorage.getItem("ep_" + key); if (s) return JSON.parse(s); } catch {}
    return initialValue;
  });
  const skipNext = useRef(false);
  const unsubRef = useRef(null);
  // Positionné à true dès que le premier snapshot Firestore est reçu (document vide ou non).
  // Exposé en 3e élément du tuple pour permettre un suivi explicite sans compter les renders.
  const [snapshotReady, setSnapshotReady] = useState(false);

  // Attach Firebase listener - with retry
  const attachListener = useCallback(() => {
    if (!key) return false;
    if (unsubRef.current) return; // already attached
    if (!_fb_db) return false;
    try {
      unsubRef.current = onSnapshot(fbDoc(_fb_db, "appdata", key), (snap) => {
        if (snap.exists()) {
          const d = snap.data().value;
          if (d !== undefined && !skipNext.current) {
            setValue(d);
            try { localStorage.setItem("ep_" + key, JSON.stringify(d)); } catch {}
          }
          skipNext.current = false;
        }
        // Marquer ready dans tous les cas (document existant ou non)
        setSnapshotReady(true);
      });
      return true;
    } catch { return false; }
  }, [key]);

  // Firebase real-time listener with retry
  useEffect(() => {
    if (attachListener()) return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; } };
    // If Firebase not ready, retry every 2s for 30s
    let attempts = 0;
    const iv = setInterval(() => {
      attempts++;
      if (attachListener() || attempts > 15) clearInterval(iv);
    }, 2000);
    return () => { clearInterval(iv); if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; } };
  }, [key, attachListener]);

  // Fallback: window.storage for artifact mode
  useEffect(() => {
    if (_fb_ready) return;
    if (typeof window === "undefined" || !window.storage) return;
    let mounted = true;
    const ver = { c: 0 };
    (async () => {
      try {
        const r = await window.storage.get(key, true);
        if (r?.value && mounted) { const p = JSON.parse(r.value); setValue(p.data); ver.c = p.version || 0; }
      } catch {}
    })();
    const iv = setInterval(async () => {
      try {
        const r = await window.storage.get(key, true);
        if (r?.value) { const p = JSON.parse(r.value); if (p.version > ver.c) { ver.c = p.version; setValue(p.data); } }
      } catch {}
    }, 3000);
    return () => { mounted = false; clearInterval(iv); };
  }, [key]);

  const setSyncValue = useCallback((updater) => {
    if (!key) return;
    setValue(prev => {
      const newVal = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem("ep_" + key, JSON.stringify(newVal)); } catch {}
      if (_fb_db) {
        skipNext.current = true;
        try { setDoc(fbDoc(_fb_db, "appdata", key), { value: newVal, updatedAt: Date.now() }); } catch {}
      }
      if (typeof window !== "undefined" && window.storage) {
        (async () => { try { await window.storage.set(key, JSON.stringify({ data: newVal, version: Date.now() }), true); } catch {} })();
      }
      return newVal;
    });
  }, [key]);

  return [value, setSyncValue, snapshotReady];
}

function useFirestoreValue(key, initialValue = null) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    setValue(initialValue);
    if (!key || !_fb_db) return undefined;
    return onSnapshot(fbDoc(_fb_db, "appdata", key), snap => {
      setValue(snap.exists() ? (snap.data().value ?? initialValue) : initialValue);
    });
  }, [key, initialValue]);
  return value;
}
const typeColors = { "Réunion": "#6366F1", "Tâche": "#F59E0B", "Focus": "#0F56B8", "Admin": "#94A3B8", "Pause": "#10B981" };

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.35)", backdropFilter: "blur(4px)", padding: 12 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: "24px 20px", minWidth: 0, maxWidth: wide ? 750 : 520, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.18)", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94A3B8" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Badge({ text, color, small }) {
  return <span style={{ display: "inline-block", padding: small ? "1px 7px" : "2px 10px", borderRadius: 20, fontSize: small ? 10 : 11, fontWeight: 600, background: color + "18", color, whiteSpace: "nowrap" }}>{text}</span>;
}
function ClubBadge({ clubId, clubs }) { const c = clubs.find(x => String(x.id) === String(clubId)); return c ? <Badge text={c.name} color={c.color} /> : null; }
function Btn({ children, onClick, color = "#0F56B8", outline, small, disabled, style: sx }) {
  return <button disabled={disabled} onClick={onClick} style={{ padding: small ? "5px 12px" : "8px 18px", borderRadius: 8, border: outline ? `1.5px solid ${color}` : "none", background: outline ? "transparent" : color, color: outline ? color : "#fff", fontSize: small ? 12 : 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: "inherit", transition: "all .15s", ...sx }}>{children}</button>;
}
function Input({ label, value, onChange, type = "text", placeholder, disabled = false, style: sx }) {
  return (<div style={{ marginBottom: 12 }}>{label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>{label}</label>}<input type={type} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: disabled ? "#F8FAFC" : "#fff", color: disabled ? "#64748B" : "inherit", ...sx }} /></div>);
}
function Select({ label, value, onChange, options, style: sx }) {
  return (<div style={{ marginBottom: 12 }}>{label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>{label}</label>}<select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff", boxSizing: "border-box", ...sx }}>{options.map(o => <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>{typeof o === "string" ? o : o.label}</option>)}</select></div>);
}
function Textarea({ label, value, onChange, rows = 3 }) {
  return (<div style={{ marginBottom: 12 }}>{label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>{label}</label>}<textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} /></div>);
}
function ProgressBar({ value, max, height = 8, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const c = color || (pct > 80 ? "#10B981" : pct > 50 ? "#F59E0B" : "#EF4444");
  return (<div style={{ background: "#F1F5F9", borderRadius: 99, height, overflow: "hidden", width: "100%" }}><div style={{ width: `${pct}%`, height: "100%", background: c, borderRadius: 99, transition: "width .4s ease" }} /></div>);
}
function Avatar({ name, size = 32, color = "#6366F1" }) {
  const initials = name ? name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase() : "?";
  return <div style={{ width: size, height: size, borderRadius: "50%", background: color + "20", color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, flexShrink: 0, border: `2px solid ${color}30` }}>{initials}</div>;
}
function AvatarStack({ ids, users, size = 28 }) {
  return (<div style={{ display: "flex" }}>{ids.slice(0, 4).map((id, i) => { const u = users.find(x => String(x.id) === String(id)); return <div key={id} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 4 - i }}><Avatar name={u ? `${u.firstName} ${u.lastName}` : "?"} size={size} color={["#6366F1", "#EC4899", "#10B981", "#F59E0B"][i % 4]} /></div>; })}{ids.length > 4 && <div style={{ marginLeft: -8, width: size, height: size, borderRadius: "50%", background: "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#6B7280" }}>+{ids.length - 4}</div>}</div>);
}
function Card({ children, style: sx, onClick }) {
  return <div onClick={onClick} style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #F1F5F9", boxShadow: "0 1px 3px rgba(0,0,0,.04)", cursor: onClick ? "pointer" : "default", transition: "box-shadow .2s, transform .15s", ...sx }}>{children}</div>;
}
function SectionHeader({ title, action, onAction }) {
  return (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#2D2D30" }}>{title}</h3>{action && <span onClick={onAction} style={{ fontSize: 12, fontWeight: 600, color: "#0F56B8", cursor: "pointer" }}>{action}</span>}</div>);
}
function ClubFilter({ clubs, selected, onChange }) {
  return (<div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}><button onClick={() => onChange(null)} style={{ padding: "4px 14px", borderRadius: 20, border: "1.5px solid " + (!selected ? "#0F56B8" : "#E2E8F0"), background: !selected ? "#0F56B810" : "transparent", color: !selected ? "#0F56B8" : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Tous</button>{clubs.map(c => (<button key={c.id} onClick={() => onChange(c.id)} style={{ padding: "4px 14px", borderRadius: 20, border: `1.5px solid ${selected === c.id ? c.color : "#E2E8F0"}`, background: selected === c.id ? c.color + "15" : "transparent", color: selected === c.id ? c.color : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{c.name}</button>))}</div>);
}
function Sparkline({ data, color = "#0F56B8", width = 80, height = 28 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  return <svg width={width} height={height} style={{ display: "block" }}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Toast({ toasts, onDismiss }) {
  const typeColors = { "🎯": "#0F56B8", "☑": "#F59E0B", "📂": "#059669", "📄": "#FEB601", "📅": "#6366F1", "💬": "#25D366", "📝": "#EC4899", "🗑️": "#EF4444", "🔓": "#94A3B8" };
  return (<div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>{toasts.map(t => {
    const accent = typeColors[t.icon] || "#0F56B8";
    return (
      <div key={t.id} style={{ background: "#fff", borderLeft: `4px solid ${accent}`, borderRadius: 12, padding: "14px 18px", boxShadow: "0 12px 32px rgba(0,0,0,.18)", display: "flex", alignItems: "center", gap: 12, animation: "slideIn .35s cubic-bezier(.16,1,.3,1)", maxWidth: 380, minWidth: 300 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: accent + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{t.icon || "🔔"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30" }}>{t.title}</div>
          {t.badges && <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>{t.badges.map((b, i) => <span key={i} style={{ fontSize: 10, padding: "1px 8px", borderRadius: 10, background: accent + "12", color: accent, fontWeight: 600 }}>{b}</span>)}</div>}
        </div>
        <button onClick={() => onDismiss(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", fontSize: 14, flexShrink: 0 }}>✕</button>
      </div>
    );
  })}</div>);
}

function MiniCalendar({ meetings, tasks, calendarEvents }) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

  const hasEvent = (d) => {
    if (!d) return { meeting: false, task: false, event: false };
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return {
      meeting: meetings.some(m => m.date === dateStr),
      task: tasks.some(t => t.deadline === dateStr && t.status !== "Terminé"),
      event: (calendarEvents || []).some(e => e.date === dateStr),
    };
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #F1F5F9" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, textAlign: "center", color: "#2D2D30" }}>{monthNames[month]} {year}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, textAlign: "center" }}>
        {["L","M","M","J","V","S","D"].map((d, i) => <div key={i} style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", padding: 3 }}>{d}</div>)}
        {cells.map((d, i) => {
          const ev = hasEvent(d);
          const isToday = d === now.getDate();
          return (
            <div key={i} style={{ fontSize: 11, padding: 2, borderRadius: 6, fontWeight: isToday ? 700 : 400, background: isToday ? "#0F56B8" : "transparent", color: isToday ? "#fff" : d ? "#475569" : "transparent", position: "relative" }}>
              {d || ""}
              {d && (ev.meeting || ev.task || ev.event) && (
                <div style={{ display: "flex", gap: 1, justifyContent: "center", position: "absolute", bottom: -1, left: 0, right: 0 }}>
                  {ev.meeting && <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#6366F1" }} />}
                  {ev.task && <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#F59E0B" }} />}
                  {ev.event && <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#10B981" }} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8 }}>
        <span style={{ fontSize: 9, color: "#6366F1", display: "flex", alignItems: "center", gap: 2 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#6366F1", display: "inline-block" }}/>Réunions</span>
        <span style={{ fontSize: 9, color: "#F59E0B", display: "flex", alignItems: "center", gap: 2 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F59E0B", display: "inline-block" }}/>Tâches</span>
        <span style={{ fontSize: 9, color: "#10B981", display: "flex", alignItems: "center", gap: 2 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10B981", display: "inline-block" }}/>Événements</span>
      </div>
    </div>
  );
}

const initialConversations = [];


// ==================== CHAT PANEL ====================
function ChatPanel({ open, onClose, users, isUserOnline, getLastSeen, currentUserId }) {
  if (!open) return null;
  const me = currentUserId || 1;
  const others = users.filter(u => String(u.id) !== String(me));

  const openWhatsApp = (phone, name) => {
    if (!phone) { alert(`${name} n'a pas de numéro de téléphone configuré.`); return; }
    // Clean phone number: remove spaces, add +33 if needed
    let clean = phone.replace(/\s+/g, "").replace(/^0/, "+33");
    if (!clean.startsWith("+")) clean = "+" + clean;
    window.open(`https://wa.me/${clean.replace("+", "")}`, "_blank");
  };

  const openGroupWhatsApp = () => {
    const phones = others.filter(u => u.phone).map(u => u.phone.replace(/\s+/g, "").replace(/^0/, "+33"));
    if (phones.length === 0) { alert("Aucun membre n'a de numéro configuré."); return; }
    // WhatsApp doesn't support group creation via URL, open first contact
    window.open(`https://wa.me/${phones[0].replace("+", "")}`, "_blank");
  };

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(380px, 100vw)", background: "#fff", boxShadow: "-8px 0 30px rgba(0,0,0,.12)", zIndex: 998, display: "flex", flexDirection: "column", fontFamily: "'Montserrat', sans-serif" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 22 }}>💬</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#2D2D30", flex: 1 }}>WhatsApp</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94A3B8" }}>✕</button>
      </div>

      {/* Group chat button */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #F1F5F9" }}>
        <button onClick={openGroupWhatsApp} style={{ width: "100%", padding: "10px 16px", borderRadius: 10, border: "none", background: "#25D366", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          👥 Ouvrir le groupe WhatsApp
        </button>
      </div>

      {/* Contact list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {others.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>Aucun contact</div>
        ) : others.map(u => {
          const online = isUserOnline ? isUserOnline(u.id) : false;
          const lastSeen = getLastSeen ? getLastSeen(u.id) : "";
          return (
            <div key={u.id} onClick={() => openWhatsApp(u.phone, u.firstName)} style={{ display: "flex", gap: 12, padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #F4F2EF", transition: "background .12s" }} onMouseEnter={e => e.currentTarget.style.background = "#F4F2EF"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: ["#6366F1","#EC4899","#10B981","#F59E0B"][u.id % 4] + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: ["#6366F1","#EC4899","#10B981","#F59E0B"][u.id % 4] }}>{u.avatar || `${u.firstName[0]}${u.lastName[0]}`}</div>
                <span style={{ position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: "50%", background: online ? "#25D366" : "#CBD5E1", border: "2px solid #fff" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#2D2D30" }}>{u.firstName} {u.lastName}</div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>{u.role}</div>
                <div style={{ fontSize: 10, color: online ? "#25D366" : "#94A3B8", marginTop: 2 }}>{online ? "🟢 En ligne" : lastSeen || "Hors ligne"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 24, color: "#25D366" }}>📱</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid #F1F5F9", textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "#CBD5E1" }}>Ouvre WhatsApp sur votre téléphone ou ordinateur</div>
      </div>
    </div>
  );
}

// ==================== NOTIFICATION BELL ====================
function NotificationBell({ notifications, onClear, onNavigate, onDismissOne }) {
  const [open, setOpen] = useState(false);
  const typeColors = { "🎯": "#0F56B8", "☑": "#F59E0B", "📂": "#059669", "📄": "#FEB601", "📅": "#6366F1", "💬": "#25D366", "📝": "#EC4899", "🗑️": "#EF4444", "🔓": "#94A3B8" };

  // Group by day
  const today = new Date().toLocaleDateString("fr-FR");
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("fr-FR");
  const groups = {};
  notifications.forEach(n => {
    const dateLabel = n.date === today ? "Aujourd'hui" : n.date === yesterday ? "Hier" : n.date || "Plus ancien";
    (groups[dateLabel] = groups[dateLabel] || []).push(n);
  });
  const groupOrder = ["Aujourd'hui", "Hier"];
  Object.keys(groups).forEach(k => { if (!groupOrder.includes(k)) groupOrder.push(k); });

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, position: "relative", padding: 4 }}>
        🔔
        {notifications.length > 0 && <span style={{ position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, background: "#EF4444", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{notifications.length}</span>}
      </button>
      {open && (
        <div style={{ position: "absolute", top: 40, right: 0, width: "min(380px, 90vw)", background: "#fff", borderRadius: 16, boxShadow: "0 16px 48px rgba(0,0,0,.18)", border: "1px solid #E2E8F0", zIndex: 999, maxHeight: 480, display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#2D2D30" }}>Notifications</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>{notifications.length} notification{notifications.length !== 1 ? "s" : ""}</div>
            </div>
            {notifications.length > 0 && <button onClick={onClear} style={{ background: "#FEF2F2", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, color: "#EF4444", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Tout effacer</button>}
          </div>
          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔕</div>
                <div style={{ fontSize: 13, color: "#94A3B8" }}>Aucune notification</div>
              </div>
            ) : (
              groupOrder.filter(k => groups[k]).map(label => (
                <div key={label}>
                  {/* Day separator */}
                  <div style={{ padding: "8px 18px 4px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ height: 1, flex: 1, background: "#E2E8F0" }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: label === "Aujourd'hui" ? "#0F56B8" : "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{label}</span>
                    <div style={{ height: 1, flex: 1, background: "#E2E8F0" }} />
                  </div>
                  {/* Items */}
                  {groups[label].map(n => {
                    const accent = typeColors[n.icon] || "#0F56B8";
                    return (
                      <div key={n.id} style={{ display: "flex", alignItems: "start", padding: "0 6px" }}>
                        <div onClick={() => { if (n.target && onNavigate) onNavigate(n.target); if (onDismissOne) onDismissOne(n.id); setOpen(false); }} style={{ flex: 1, display: "flex", gap: 10, alignItems: "start", padding: "10px 12px", borderRadius: 10, margin: "2px 0", cursor: "pointer", transition: "background .12s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#F4F2EF"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: accent + "12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{n.icon || "🔔"}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#2D2D30", lineHeight: 1.3 }}>{n.title}</div>
                            {n.badges && <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>{n.badges.map((b, i) => <span key={i} style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: accent + "10", color: accent, fontWeight: 600 }}>{b}</span>)}</div>}
                            <div style={{ fontSize: 10, color: "#CBD5E1", marginTop: 3 }}>{n.time}</div>
                          </div>
                          {n.target && <span style={{ fontSize: 11, color: accent, flexShrink: 0, marginTop: 4 }}>→</span>}
                        </div>
                        <button onClick={e => { e.stopPropagation(); if (onDismissOne) onDismissOne(n.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#CBD5E1", padding: "14px 6px 10px 0", flexShrink: 0 }} title="Supprimer"
                          onMouseEnter={e => e.currentTarget.style.color = "#EF4444"}
                          onMouseLeave={e => e.currentTarget.style.color = "#CBD5E1"}>✕</button>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== DASHBOARD ====================
function Dashboard({ clubs, objectives, tasks, setTasks, meetings, slots, publications, navigateTo, calendarEvents, currentUser, currentUserId, isAdmin, isDirector, users }) {
  const today = new Date();
  const dayIndex = today.getDay();
  const dayName = dayIndex >= 1 && dayIndex <= 5 ? DAYS[dayIndex - 1] : "Lundi";
  const todayStr = today.toISOString().split("T")[0];

  const myClubs = isAdmin ? clubs : clubs.filter(c => (currentUser?.clubs || []).some(uc => String(uc) === String(c.id)));
  const directorClubIds = (currentUser?.clubs || []).map(String);
  const clubMemberIds = isDirector ? users.filter(u => (u.clubs || []).some(c => directorClubIds.includes(String(c)))).map(u => String(u.id)) : [];
  const userClubIds = (currentUser?.clubs || []).map(String);
  const myObjectives = isAdmin ? objectives : objectives.filter(o => userClubIds.includes(String(o.club)));
  const dashboardObjectiveStatus = o => {
    if (["success", "almost_success", "failed"].includes(o.status)) return o.status;
    if (o.startDate && o.startDate > todayStr) return "scheduled";
    if (o.deadline && o.deadline < todayStr) return o.status || "failed";
    return o.status || "active";
  };
  const dashboardObjectiveProgress = o => {
    if (o.progress !== undefined && o.progress !== null) return Math.max(0, Math.min(100, Number(o.progress || 0)));
    const current = Number(o.current || 0), baseline = Number(o.baseline || 0), target = Number(o.target || 0);
    if (target > baseline) return Math.max(0, Math.min(100, Math.round(((current - baseline) / (target - baseline)) * 100)));
    return target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;
  };
  const dashboardPeriod = o => {
    if (!o.startDate || !o.deadline) return "Période non définie";
    const days = Math.max(1, Math.round((new Date(o.deadline) - new Date(o.startDate)) / 86400000) + 1);
    return days <= 7 ? `${days} jours` : days <= 45 ? "Mensuel" : days >= 300 ? "Annuel" : `${days} jours`;
  };
  const myTasks = tasks.filter(t => String(t.assigneeId) === String(currentUserId) || String(t.owner) === String(currentUserId) || (t.assignedTo || []).some(a => String(a) === String(currentUserId)));
  const myMeetings = isAdmin ? meetings : meetings.filter(m => m.participants.includes(currentUserId));

  const todayMeetings = myMeetings.filter(m => m.date === todayStr).map(m => ({ id: `m-${m.id}`, time: m.time || "00:00", duration: m.duration, activity: m.title, type: "Réunion", source: "meeting" }));
  const todayMyTasks = myTasks.filter(t => t.deadline === todayStr && t.status !== "Terminé");
  const urgentTasks = myTasks.filter(t => t.urgency === "Urgent" && t.status !== "Terminé");
  const upcomingPubs = publications.filter(p => String(p.owner) === String(CURRENT_USER_ID) && p.date >= todayStr).slice(0, 4);
  const [instaClub, setInstaClub] = useState(myClubs[0]?.id || 1);
  const clubPosts = instagramPosts.filter(p => p.club === instaClub);

  // Widget system
  const ALL_WIDGETS = [
    { id: "schedule", name: "Tâches du jour", icon: "📋", size: "large" },
    { id: "miniCal", name: "Mini calendrier", icon: "📅", size: "small" },
    { id: "objectives", name: "Objectifs par club", icon: "🎯", size: "full" },
    { id: "urgentTasks", name: "Tâches urgentes", icon: "☑", size: "half" },
    { id: "publications", name: "Prochaines publications", icon: "📰", size: "half" },
    { id: "instagram", name: "Feed Instagram", icon: "📷", size: "full" },
    { id: "stats", name: "Statistiques rapides", icon: "📊", size: "full" },
    { id: "recentProjects", name: "Projets récents", icon: "📂", size: "half" },
    { id: "teamStatus", name: "Équipe en ligne", icon: "👥", size: "half" },
    { id: "countdown", name: "Prochain événement", icon: "⏳", size: "small" },
    { id: "clock", name: "Horloge", icon: "🕐", size: "small" },
    { id: "workTimer", name: "Chronomètre de travail", icon: "⏱️", size: "small" },
  ];

  const defaultLayout = ["schedule", "miniCal", "objectives", "urgentTasks", "publications", "instagram"];
  const [layout, setLayout] = useState(() => { try { const s = localStorage.getItem("ep_dashboard_layout"); if (s) return JSON.parse(s); } catch {} return defaultLayout; });
  useEffect(() => { try { localStorage.setItem("ep_dashboard_layout", JSON.stringify(layout)); } catch {} }, [layout]);
  const [editMode, setEditMode] = useState(false);
  const [widgetPicker, setWidgetPicker] = useState(false);
  const dragWidget = useRef(null);

  // Clock widget
  const [clockTime, setClockTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setClockTime(new Date()), 1000); return () => clearInterval(t); }, []);

  // Work timer widget
  const [wTimerRunning, setWTimerRunning] = useState(false);
  const [wTimerStart, setWTimerStart] = useState(null);
  const [wTimerElapsed, setWTimerElapsed] = useState(0);
  const [wTimerSessions, setWTimerSessions] = useState([]);
  const wTimerRef = useRef(null);
  useEffect(() => {
    if (wTimerRunning) { wTimerRef.current = setInterval(() => setWTimerElapsed(Math.floor((Date.now() - wTimerStart) / 1000)), 1000); }
    else { if (wTimerRef.current) clearInterval(wTimerRef.current); }
    return () => { if (wTimerRef.current) clearInterval(wTimerRef.current); };
  }, [wTimerRunning, wTimerStart]);
  const wStartTimer = () => { setWTimerStart(Date.now()); setWTimerElapsed(0); setWTimerRunning(true); };
  const wPauseTimer = () => { setWTimerRunning(false); };
  const wStopTimer = () => {
    if (wTimerElapsed > 0) setWTimerSessions(p => [...p, { duration: wTimerElapsed, date: new Date().toLocaleString("fr-FR") }]);
    setWTimerRunning(false); setWTimerElapsed(0); setWTimerStart(null);
  };
  const fmtTimer = (s) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`; };
  const totalWorked = wTimerSessions.reduce((a, s) => a + s.duration, 0) + (wTimerRunning ? wTimerElapsed : 0);

  const addWidget = (id) => { if (!layout.includes(id)) setLayout(p => [...p, id]); setWidgetPicker(false); };
  const removeWidget = (id) => setLayout(p => p.filter(w => w !== id));
  const moveWidget = (from, to) => { setLayout(p => { const n = [...p]; const [moved] = n.splice(from, 1); n.splice(to, 0, moved); return n; }); };

  // Widget renderers
  const renderWidget = (widgetId) => {
    const w = ALL_WIDGETS.find(x => String(x.id) === String(widgetId));
    if (!w) return null;
    const wrapStyle = editMode ? { position: "relative", border: "2px dashed #0F56B840", borderRadius: 14, padding: 2 } : {};

    const editOverlay = editMode ? (
      <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 3, zIndex: 5 }}>
        <button onClick={() => removeWidget(widgetId)} style={{ width: 22, height: 22, borderRadius: 6, background: "#FEE2E2", border: "none", color: "#EF4444", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: "#0F56B810", border: "none", color: "#0F56B8", fontSize: 10, cursor: "grab", display: "flex", alignItems: "center", justifyContent: "center" }}>⠿</span>
      </div>
    ) : null;

    switch (widgetId) {
      case "schedule": return (
        <div style={wrapStyle}>
          {editOverlay}
          <Card>
            <SectionHeader title={`📋 Mes tâches du jour — ${dayName}`} />

            {todayMyTasks.length > 0 ? (
              <div style={{ marginTop: 6 }}>
                {todayMyTasks.map(t => (<div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                  <div onClick={() => setTasks && setTasks(p => (p||[]).map(x => String(x.id)===String(t.id)?{...x,status:x.status==="Terminé"?"À faire":"Terminé"}:x))} style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${t.status==="Terminé"?"#10B981":"#CBD5E1"}`, background: t.status==="Terminé"?"#10B981":"transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>{t.status==="Terminé"&&<span style={{color:"#fff",fontSize:10,fontWeight:800}}>✓</span>}</div>
                  <span style={{ fontSize: 12, color: t.status==="Terminé"?"#94A3B8":"#2D2D30", flex: 1, textDecoration: t.status==="Terminé"?"line-through":"none" }}>{t.title}</span>
                  <span style={{ padding: "1px 6px", borderRadius: 4, background: t.urgency==="Urgent"?"#EF444415":"#F59E0B15", color: t.urgency==="Urgent"?"#EF4444":"#F59E0B", fontSize: 9, fontWeight: 600 }}>{t.urgency||"Normal"}</span>
                </div>))}
              </div>
            ) : (
              <div style={{ padding: "10px 0", textAlign: "center", color: "#CBD5E1", fontSize: 11 }}>Aucune tâche avec échéance aujourd'hui</div>
            )}
          </Card>
        </div>);
      case "miniCal": return (<div style={wrapStyle}>{editOverlay}<MiniCalendar meetings={myMeetings} tasks={myTasks} calendarEvents={calendarEvents.filter(e => e.visibility === "all" || String(e.owner) === String(currentUserId))} /></div>);
      case "objectives": return (
        <div style={wrapStyle}>
          {editOverlay}
          <SectionHeader title="🎯 Objectifs par club" action="Voir tout →" onAction={() => navigateTo("objectives")} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {myClubs.map(c => { const cObjs = myObjectives.filter(o => String(o.club) === String(c.id) && dashboardObjectiveStatus(o) === "active" && (!o.startDate || o.startDate <= todayStr) && (!o.deadline || o.deadline >= todayStr)).sort((a,b)=>(a.deadline||"").localeCompare(b.deadline||"")); return (<Card key={c.id} style={{ padding: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: c.color }} /><span style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30" }}>{c.name}</span><span style={{ marginLeft:"auto",fontSize:9,fontWeight:800,color:"#64748B",background:"#F1F5F9",padding:"3px 7px",borderRadius:8 }}>{cObjs.length} en cours</span></div>{cObjs.slice(0,6).map(o => { const progress=dashboardObjectiveProgress(o); return (<div key={o.id} style={{ marginBottom: 12, paddingBottom: 10, borderBottom:"1px solid #F1F5F9" }}><div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:4 }}><span style={{fontSize:11,fontWeight:700,color:"#334155",flex:1}}>{o.title}</span><span style={{fontSize:8,fontWeight:800,color:"#6366F1",background:"#6366F112",padding:"2px 6px",borderRadius:6}}>{dashboardPeriod(o)}</span></div><div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#94A3B8",marginBottom:5}}><span>{o.startDate} → {o.deadline}</span><span><strong style={{color:"#475569"}}>{Number(o.current||0).toLocaleString("fr-FR")}</strong> / {Number(o.target||0).toLocaleString("fr-FR")} {o.unit} · <strong style={{color:progress>=80?"#10B981":progress>=50?"#F59E0B":"#EF4444"}}>{progress}%</strong></span></div><ProgressBar value={progress} max={100} height={6} /></div>); })}{cObjs.length > 6 && <button onClick={()=>navigateTo("objectives")} style={{border:0,background:"none",color:"#0F56B8",fontSize:10,fontWeight:700,cursor:"pointer"}}>Voir les {cObjs.length-6} autres objectifs →</button>}{cObjs.length === 0 && <div style={{ fontSize: 11, color: "#94A3B8" }}>Aucun objectif actuellement en cours</div>}</Card>); })}
          </div>
        </div>);
      case "urgentTasks": return (
        <div style={wrapStyle}>
          {editOverlay}
          <SectionHeader title="☑ Tâches urgentes" action="Voir tout →" onAction={() => navigateTo("todo")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {urgentTasks.slice(0, 4).map(t => (<Card key={t.id} style={{ padding: 12 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: 13, fontWeight: 600, color: "#2D2D30" }}>{t.title}</div><div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{t.assignee} · {t.deadline}</div></div>{(t.clubs || (t.club ? [t.club] : [])).map(cid => <ClubBadge key={cid} clubId={cid} clubs={clubs} />)}</div></Card>))}
            {urgentTasks.length === 0 && <Card style={{ padding: 12 }}><span style={{ fontSize: 12, color: "#94A3B8" }}>Aucune tâche urgente 🎉</span></Card>}
          </div>
        </div>);
      case "publications": return (
        <div style={wrapStyle}>
          {editOverlay}
          <SectionHeader title="📰 Prochaines publications" action="Voir tout →" onAction={() => navigateTo("editorial")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcomingPubs.map(p => (<Card key={p.id} style={{ padding: 12 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: 13, fontWeight: 600, color: "#2D2D30" }}>{p.title}</div><div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{p.platform} · {p.type} · {p.date}</div></div><Badge text={p.status} color={p.status === "Publié" ? "#10B981" : p.status === "Planifié" ? "#0F56B8" : "#F59E0B"} /></div></Card>))}
            {upcomingPubs.length === 0 && <Card style={{ padding: 12 }}><span style={{ fontSize: 12, color: "#94A3B8" }}>Aucune publication à venir</span></Card>}
          </div>
        </div>);
      case "instagram": return (
        <div style={wrapStyle}>
          {editOverlay}
          <Card>
            <SectionHeader title="📷 Feed Instagram" />
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>{myClubs.filter(c => c.instagram?.username).map(c => (<button key={c.id} onClick={() => setInstaClub(c.id)} style={{ padding: "3px 10px", borderRadius: 16, border: `1.5px solid ${instaClub === c.id ? c.color : "#E2E8F0"}`, background: instaClub === c.id ? c.color + "15" : "transparent", color: instaClub === c.id ? c.color : "#94A3B8", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{c.name}</button>))}</div>
            {(() => { const ac = myClubs.find(c => String(c.id) === String(instaClub)); const ig = ac?.instagram; if (!ig?.username) return <div style={{ textAlign: "center", padding: 16, color: "#94A3B8", fontSize: 11 }}>Non configuré</div>; return (<div><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 12px", background: "#F4F2EF", borderRadius: 8 }}><span style={{ fontSize: 14 }}>📷</span><span style={{ fontSize: 12, fontWeight: 700 }}>@{ig.username}</span><span style={{ width: 6, height: 6, borderRadius: "50%", background: ig.connected ? "#10B981" : "#EF4444" }} /><a href={`https://instagram.com/${ig.username}`} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontSize: 10, color: "#E4405F", fontWeight: 600, textDecoration: "none" }}>Profil ↗</a></div>{ig.connected ? <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>{clubPosts.map(p => (<div key={p.id} style={{ aspectRatio: "1", borderRadius: 8, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📷</div>))}</div> : <div style={{ textAlign: "center", padding: 16, color: "#EF4444", fontSize: 11 }}>Non connecté</div>}</div>); })()}
          </Card>
        </div>);
      case "stats": return (
        <div style={wrapStyle}>
          {editOverlay}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[{ label: "Tâches actives", value: myTasks.filter(t => t.status !== "Terminé").length, icon: "☑", color: "#F59E0B" }, { label: "Réunions ce mois", value: myMeetings.filter(m => m.date.startsWith(todayStr.slice(0, 7))).length, icon: "🤝", color: "#6366F1" }, { label: "Objectifs actifs", value: myObjectives.filter(o => o.status === "active").length, icon: "🎯", color: "#0F56B8" }, { label: "Publications planifiées", value: upcomingPubs.length, icon: "📰", color: "#10B981" }].map(s => (
              <Card key={s.label} style={{ padding: 14, textAlign: "center" }}><div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div><div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div><div style={{ fontSize: 10, color: "#94A3B8" }}>{s.label}</div></Card>
            ))}
          </div>
        </div>);
      case "recentProjects": return (
        <div style={wrapStyle}>
          {editOverlay}
          <SectionHeader title="📂 Projets récents" action="Voir tout →" onAction={() => navigateTo("projects")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(isAdmin ? tasks : tasks.filter(t => String(t.assigneeId) === String(currentUserId))).length === 0 && <Card style={{ padding: 12 }}><span style={{ fontSize: 12, color: "#94A3B8" }}>Aucun projet</span></Card>}
          </div>
        </div>);
      case "teamStatus": {
        const myClubIds = currentUser?.clubs || [];
        const teamUsers = isAdmin ? users : users.filter(u => String(u.id) !== String(currentUserId) && u.clubs.some(c => myClubIds.includes(c)));
        const todayDay = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"][new Date().getDay()];
        const getUserStatus = (u) => {
          // The logged-in user is ALWAYS active
          if (String(u.id) === String(currentUserId)) return { color: "#10B981", label: "En ligne", bg: "#10B98115" };
          // Check vacations
          const now = todayStr;
          const onVacation = (u.vacations || []).some(v => v.from <= now && v.to >= now);
          if (onVacation) return { color: "#94A3B8", label: "🏖️ En vacances", bg: "#94A3B815" };
          // Check day off
          const isDayOff = u.daysOff && u.daysOff[todayDay];
          if (isDayOff) return { color: "#EF4444", label: "Jour de congé", bg: "#EF444415" };
          // Outside work hours = disconnected for others
          const hour = new Date().getHours();
          if (hour < 8 || hour >= 19) return { color: "#EF4444", label: "Déconnecté", bg: "#EF444415" };
          // During work hours: simulate (even id = active, odd = inactive)
          if (u.id % 2 === 0) return { color: "#10B981", label: "En ligne", bg: "#10B98115" };
          return { color: "#F59E0B", label: "Inactif", bg: "#F59E0B15" };
        };
        return (
        <div style={wrapStyle}>
          {editOverlay}
          <Card>
            <SectionHeader title="👥 Équipe" />
            {/* Legend */}
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              {[{ c: "#10B981", l: "En ligne" }, { c: "#F59E0B", l: "Inactif" }, { c: "#EF4444", l: "Déconnecté" }, { c: "#94A3B8", l: "Vacances" }].map(s => (
                <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: s.c }} /><span style={{ fontSize: 9, color: "#94A3B8" }}>{s.l}</span></div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {teamUsers.length === 0 ? <div style={{ padding: 12, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>Aucun collègue</div> : teamUsers.map(u => {
                const st = getUserStatus(u);
                return (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: st.bg }}>
                  <div style={{ position: "relative" }}>
                    <Avatar name={`${u.firstName} ${u.lastName}`} size={34} color={["#6366F1","#EC4899","#10B981","#F59E0B"][u.id % 4]} />
                    <span style={{ position: "absolute", bottom: -1, right: -1, width: 12, height: 12, borderRadius: "50%", background: st.color, border: "2px solid #fff" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#2D2D30" }}>{u.firstName} {u.lastName}</span>
                      {u.admin && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 6, background: "#FEB60115", color: "#FEB601", fontWeight: 700 }}>Admin</span>}
                    </div>
                    <div style={{ fontSize: 10, color: "#94A3B8" }}>{u.role}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: st.color }}>{st.label}</span>
                    <div style={{ display: "flex", gap: 2 }}>{u.clubs.slice(0, 3).map(cid => { const cl = clubs.find(x => String(x.id) === String(cid)); return cl ? <div key={cid} style={{ width: 8, height: 8, borderRadius: "50%", background: cl.color }} title={cl.name} /> : null; })}</div>
                  </div>
                </div>);
              })}
            </div>
          </Card>
        </div>);
      }
      case "countdown": return (
        <div style={wrapStyle}>
          {editOverlay}
          <Card style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>⏳</div>
            {(() => { const next = [...myMeetings, ...calendarEvents.filter(e => e.visibility === "all" || String(e.owner) === String(currentUserId))].filter(e => (e.date || "") > todayStr).sort((a, b) => a.date.localeCompare(b.date))[0]; if (!next) return <div style={{ fontSize: 12, color: "#94A3B8" }}>Aucun événement à venir</div>; const days = Math.ceil((new Date(next.date) - new Date(todayStr)) / 86400000); return (<div><div style={{ fontSize: 22, fontWeight: 800, color: "#0F56B8" }}>{days}j</div><div style={{ fontSize: 12, fontWeight: 600, color: "#2D2D30", marginTop: 2 }}>{next.title}</div><div style={{ fontSize: 10, color: "#94A3B8" }}>{next.date}</div></div>); })()}
          </Card>
        </div>);
      case "clock": return (
        <div style={wrapStyle}>
          {editOverlay}
          <Card style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 38, fontWeight: 800, color: "#2D2D30", fontFamily: "JetBrains Mono, monospace", letterSpacing: 2 }}>
              {clockTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>
              {clockTime.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          </Card>
        </div>);
      case "workTimer": return (
        <div style={wrapStyle}>
          {editOverlay}
          <Card style={{ padding: 20 }}>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Temps de travail</div>
              <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "JetBrains Mono, monospace", color: wTimerRunning ? "#10B981" : wTimerElapsed > 0 ? "#F59E0B" : "#2D2D30" }}>
                {fmtTimer(wTimerElapsed)}
              </div>
              {wTimerRunning && <div style={{ fontSize: 10, color: "#10B981", marginTop: 4 }}>● En cours...</div>}
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>
              {!wTimerRunning ? (
                <button onClick={wStartTimer} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#10B981", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>▶ {wTimerElapsed > 0 ? "Reprendre" : "Démarrer"}</button>
              ) : (
                <button onClick={wPauseTimer} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#F59E0B", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>⏸ Pause</button>
              )}
              {(wTimerElapsed > 0 || wTimerRunning) && <button onClick={wStopTimer} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#EF4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>⏹ Terminer</button>}
            </div>
            {/* Total today */}
            <div style={{ textAlign: "center", padding: "8px 0", borderTop: "1px solid #F1F5F9" }}>
              <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 2 }}>Total aujourd'hui</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0F56B8", fontFamily: "JetBrains Mono, monospace" }}>{fmtTimer(totalWorked)}</div>
            </div>
            {/* Sessions log */}
            {wTimerSessions.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", marginBottom: 4 }}>Sessions :</div>
                {wTimerSessions.map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6B7280", padding: "2px 0" }}>
                    <span>Session {i + 1}</span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>{fmtTimer(s.duration)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>);
      default: return null;
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#2D2D30" }}>Bonjour {currentUser?.firstName || "Marie"} 👋</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>{todayMyTasks.length > 0 ? `Aujourd'hui, ${todayMyTasks.filter(t => t.status === "Terminé").length}/${todayMyTasks.length} tâche(s) avec échéance` : "Aucune tâche avec échéance aujourd'hui"}</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setEditMode(p => !p)} style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${editMode ? "#0F56B8" : "#E2E8F0"}`, background: editMode ? "#0F56B8" : "#fff", color: editMode ? "#fff" : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{editMode ? "✓ Terminer" : "⚙ Personnaliser"}</button>
          {editMode && <button onClick={() => setWidgetPicker(true)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#10B981", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Widget</button>}
          {editMode && <button onClick={() => setLayout(defaultLayout)} style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>↺ Défaut</button>}
        </div>
      </div>

      {/* Widget grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {layout.map((wId, idx) => {
          const w = ALL_WIDGETS.find(x => String(x.id) === String(wId));
          if (!w) return null;
          return (
            <div key={wId}
              draggable={editMode}
              onDragStart={() => { dragWidget.current = idx; }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragWidget.current !== null && dragWidget.current !== idx) moveWidget(dragWidget.current, idx); dragWidget.current = null; }}
              style={{ cursor: editMode ? "grab" : "default" }}>
              {renderWidget(wId)}
            </div>
          );
        })}
      </div>

      {/* Widget picker modal */}
      {widgetPicker && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setWidgetPicker(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, width: "min(400px, 90vw)", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#2D2D30", marginBottom: 4 }}>Ajouter un widget</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 16 }}>Choisissez les widgets à afficher sur votre dashboard</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ALL_WIDGETS.map(w => {
                const isActive = layout.includes(w.id);
                return (
                  <div key={w.id} onClick={() => { if (isActive) removeWidget(w.id); else addWidget(w.id); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${isActive ? "#0F56B8" : "#F1F5F9"}`, background: isActive ? "#0F56B808" : "#fff", cursor: "pointer", transition: "all .15s" }}>
                    <span style={{ fontSize: 20 }}>{w.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#2D2D30" }}>{w.name}</div>
                    </div>
                    <span style={{ fontSize: 18, color: isActive ? "#0F56B8" : "#CBD5E1" }}>{isActive ? "✓" : "+"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ==================== OBJECTIVES ====================
function ObjectivesPage({ clubs, objectives, setObjectives, currentUserId, isAdmin, isDirector, currentUser, users, addToast, reportingData }) {
  const [clubFilter, setClubFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState("current");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const metricOptions = [
    { key: "abonnes", label: "Abonnés", unit: "abonnés" }, { key: "txEvol", label: "Taux d’évolution", unit: "%" },
    { key: "nouveauxAbonnes", label: "Nouveaux abonnés", unit: "nouveaux abonnés" },
    { key: "porteeMoyJour", label: "Portée moyenne / jour", unit: "personnes / jour" },
    { key: "storiesParJour", label: "Stories / jour", unit: "stories / jour" },
    { key: "postsTotal", label: "Nombre de posts (reels + publications)", unit: "posts" },
    { key: "publications", label: "Publications", unit: "publications" }, { key: "reels", label: "Reels", unit: "reels" }, { key: "stories", label: "Stories", unit: "stories" },
    { key: "porteeMoy", label: "Portée moyenne par publication", unit: "personnes" }, { key: "porteeMoyReel", label: "Portée moyenne par reel", unit: "personnes" },
    { key: "porteeMoyStory", label: "Portée moyenne par story", unit: "personnes" }, { key: "interactions", label: "Interactions", unit: "interactions" },
    { key: "engagement", label: "Engagement", unit: "%" }, { key: "vues", label: "Vues", unit: "vues" }, { key: "jaimes", label: "J’aime", unit: "j’aime" },
    { key: "commentaires", label: "Commentaires", unit: "commentaires" }, { key: "partages", label: "Partages", unit: "partages" }, { key: "enregistrements", label: "Enregistrements", unit: "enregistrements" },
  ];
  const latestReportingMonth = Object.keys(reportingData || {}).filter(key => (reportingData[key] || []).length).sort().pop();
  const memberIdsForClub = clubId => users.filter(user => (user.clubs || []).some(id => String(id) === String(clubId))).map(user => user.id);
  const getMetricValue = (clubId, metricKey) => {
    const row = (reportingData?.[latestReportingMonth] || []).find(item => String(item.clubId) === String(clubId));
    if (!row) return 0;
    const [year, month] = String(latestReportingMonth || "").split("-").map(Number);
    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    const measuredDays = isCurrentMonth ? Math.max(1, now.getDate() - 1) : new Date(year, month, 0).getDate();
    if (metricKey === "nouveauxAbonnes") return Number(row.evolutionAbonnes || 0);
    if (metricKey === "storiesParJour") return Number((Number(row.stories || 0) / measuredDays).toFixed(2));
    if (metricKey === "postsTotal") return Number(row.publications || 0) + Number(row.reels || 0);
    if (metricKey === "porteeMoyJour") {
      const estimatedReach = Number(row.porteeTotale || 0) || (Number(row.porteeMoy || 0) * Number(row.publications || 0)) + (Number(row.porteeMoyReel || 0) * Number(row.reels || 0));
      return Number((estimatedReach / measuredDays).toFixed(2));
    }
    return Number(row?.[metricKey] || 0);
  };
  const emptyObjectiveForm = () => { const club = clubs[0]?.id || 1; return { title: "", club, startDate: new Date().toISOString().slice(0, 10), deadline: "", target: 0, current: 0, baseline: 0, metricKey: "abonnes", unit: "abonnés", source: "metricool", assignedTo: memberIdsForClub(club) }; };
  const [form, setForm] = useState(emptyObjectiveForm);
  const directorClubIds = (currentUser?.clubs || []).map(String);
  const clubMemberIds = isDirector ? users.filter(u => (u.clubs || []).some(c => directorClubIds.includes(String(c)))).map(u => String(u.id)) : [];
  const userClubIds = (currentUser?.clubs || []).map(String);
  const myObjectives = isAdmin ? objectives : objectives.filter(o => userClubIds.includes(String(o.club)));
  const isFinishedStatus = status => ["success", "almost_success", "failed"].includes(status);
  const todayKey = new Date().toISOString().slice(0, 10);
  const objectiveStatus = o => !isFinishedStatus(o.status) && o.startDate && o.startDate > todayKey ? "scheduled" : o.status;
  const filtered = myObjectives.filter(o => { const status = objectiveStatus(o); return (!clubFilter || String(o.club) === String(clubFilter)) && (statusFilter === "all" || (statusFilter === "finished" ? isFinishedStatus(status) : statusFilter === "scheduled" ? status === "scheduled" : !isFinishedStatus(status) && status !== "scheduled")); }).sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""));
  const periodLabel = o => { if (!o.startDate || !o.deadline) return "Période non définie"; const days = Math.max(1, Math.round((new Date(o.deadline) - new Date(o.startDate)) / 86400000) + 1); return days <= 7 ? `Court terme · ${days} j` : days <= 45 ? `Mensuel · ${days} j` : days <= 120 ? `Trimestriel · ${days} j` : days >= 300 ? `Annuel · ${days} j` : `Long terme · ${days} j`; };
  const openNew = () => { setEditing(null); const next = emptyObjectiveForm(); next.baseline = getMetricValue(next.club, next.metricKey); next.current = next.baseline; setForm(next); setModalOpen(true); };
  const openEdit = (o) => { setEditing(o.id); setForm({ ...emptyObjectiveForm(), ...o, startDate: o.startDate || o.createdAt?.slice?.(0, 10) || "", baseline: Number(o.baseline ?? o.current ?? 0), assignedTo: memberIdsForClub(o.club) }); setModalOpen(true); };
  const save = () => { if (!form.title || !form.startDate || !form.deadline) return; const isScheduled = form.startDate > todayKey; const liveCurrent = isScheduled ? 0 : getMetricValue(form.club, form.metricKey); const assignedTo = memberIdsForClub(form.club); const existing = objectives.find(o => String(o.id) === String(editing)); const status = isScheduled ? "scheduled" : existing && isFinishedStatus(existing.status) ? existing.status : "active"; const payload = { ...form, assignedTo, status, current: liveCurrent, baseline: isScheduled ? 0 : editing ? Number(form.baseline || 0) : liveCurrent, progress: isScheduled ? 0 : form.progress, source: "metricool", updatedFromMetricoolAt: Date.now() }; if (editing) { setObjectives(p => p.map(o => String(o.id) === String(editing) ? { ...o, ...payload } : o)); addToast({ title: `Objectif modifié : ${form.title}`, icon: "✏️", badges: ["Objectif"], target: "objectives" }, assignedTo); } else { setObjectives(p => [...p, { id: uid(), ...payload, owner: currentUserId, createdAt: new Date().toISOString() }]); addToast({ title: `Nouvel objectif : ${form.title}`, icon: "🎯", badges: [isScheduled ? "Objectif planifié" : "Objectif ajouté"], target: "objectives" }); assignedTo.forEach(uid2 => { const u = users.find(x => String(x.id) === String(uid2)); if (u) addToast({ title: `🎯 Objectif assigné : ${form.title}`, icon: "🎯", badges: [u.firstName, "Assigné"], target: "objectives", notifType: "TASK_ASSIGNED" }, [uid2]); }); } setModalOpen(false); };
  const del = (id) => { const o = objectives.find(x => String(x.id) === String(id)); setObjectives(p => p.filter(o => String(o.id) !== String(id))); if (o) addToast({ title: `Objectif supprimé : ${o.title}`, icon: "🗑️", badges: ["Objectif"], target: "objectives" }); };
  const setStatus = (id, st) => { setObjectives(p => p.map(o => String(o.id) === String(id) ? { ...o, status: st } : o)); const o = objectives.find(x => String(x.id) === String(id)); const labels = { success: "✓ Réussi", postponed: "↻ Reporté", failed: "✕ Raté", active: "🔄 Réactivé" }; addToast({ title: `${o?.title || "Objectif"} — ${labels[st] || st}`, icon: "🎯", badges: [labels[st]], target: "objectives" }); };
  const updateCurrent = (id, val) => setObjectives(p => p.map(o => String(o.id) === String(id) ? { ...o, current: Number(val) } : o));
  const liveValue = o => objectiveStatus(o) === "scheduled" ? 0 : o.evaluatedAt ? Number(o.current || 0) : o.source === "metricool" && o.metricKey ? getMetricValue(o.club, o.metricKey) : Number(o.current || 0);
  const pct = (o) => o.progress !== undefined ? Number(o.progress || 0) : (() => { const current = liveValue(o); const start = Number(o.baseline || 0); const target = Number(o.target || 0); return target > start ? Math.max(0, Math.min(100, Math.round(((current - start) / (target - start)) * 100))) : target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0; })();
  const canEdit = () => isAdmin && !isDirector;
  const isAssignee = (o) => (o.assignedTo || []).some(a => String(a) === String(currentUserId)) && String(o.owner) !== String(currentUserId);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Objectifs</h2>{isAdmin && !isDirector && <Btn onClick={openNew}>+ Nouvel objectif</Btn>}</div>
      {isAdmin && <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>{[["En cours",myObjectives.filter(o => !isFinishedStatus(objectiveStatus(o)) && objectiveStatus(o) !== "scheduled").length,"#0F56B8"],["À venir",myObjectives.filter(o => objectiveStatus(o) === "scheduled").length,"#6366F1"],["Réussis",myObjectives.filter(o => objectiveStatus(o) === "success").length,"#10B981"],["À surveiller / Ratés",myObjectives.filter(o => ["almost_success","failed"].includes(objectiveStatus(o))).length,"#EF4444"]].map(([label,value,color]) => <Card key={label} style={{ padding: 11, borderTop: `3px solid ${color}` }}><div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 800, textTransform: "uppercase" }}>{label}</div><div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div></Card>)}</div>}
      <ClubFilter clubs={clubs} selected={clubFilter} onChange={setClubFilter} />
      <div style={{ display: "flex", gap: 5, margin: "10px 0 14px", flexWrap: "wrap" }}>{[["current","En cours"],["scheduled","À venir"],["finished","Historique"],["all","Tous"]].map(([key,label]) => <button key={key} onClick={() => setStatusFilter(key)} style={{ padding: "6px 12px", border: 0, borderRadius: 8, background: statusFilter === key ? "#1E3A5F" : "#F1F5F9", color: statusFilter === key ? "#fff" : "#64748B", fontWeight: 700, cursor: "pointer" }}>{label}</button>)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {filtered.map(o => {
          const status = objectiveStatus(o); const p = status === "scheduled" ? 0 : pct(o); const isOver = isFinishedStatus(status); const currentValue = liveValue(o);
          const assigned = (o.assignedTo || []).map(uid2 => users.find(u => String(u.id) === String(uid2))).filter(Boolean);
          return (
            <Card key={o.id} style={{ opacity: isOver ? 0.7 : 1, position: "relative", overflow: "hidden" }}>
              {(isOver || status === "scheduled") && <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "4px 0", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#fff", background: status === "success" ? "#10B981" : status === "almost_success" ? "#F59E0B" : status === "scheduled" ? "#6366F1" : "#EF4444" }}>{status === "success" ? "✓ Réussi" : status === "almost_success" ? "≈ Presque réussi" : status === "scheduled" ? "◷ À venir" : "✕ Raté"}</div>}
              <div style={{ marginTop: isOver || status === "scheduled" ? 20 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}><div><div style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30" }}>{o.title}</div><ClubBadge clubId={o.club} clubs={clubs} /></div><div style={{ display: "flex", gap: 4 }}>{canEdit(o) && <button onClick={() => openEdit(o)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>✏️</button>}{canEdit(o) && <button onClick={() => del(o.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>🗑️</button>}</div></div>
                <div style={{ display: "inline-block", fontSize: 9, fontWeight: 800, color: "#6366F1", background: "#6366F112", padding: "3px 7px", borderRadius: 7, marginBottom: 5 }}>{periodLabel(o)}</div>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>📅 {o.startDate || "—"} → {o.deadline || "—"}</div>
                {o.source === "metricool" && <div style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 8, background: status === "scheduled" ? "#6366F112" : "#10B98112", color: status === "scheduled" ? "#6366F1" : "#059669", fontSize: 9, fontWeight: 800, marginBottom: 7 }}>{status === "scheduled" ? `◷ Mesure Metricool à partir du ${o.startDate}` : "● Actualisé automatiquement via Metricool"}</div>}
                {assigned.length > 0 && <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>{assigned.map(u => <span key={u.id} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: "#0F56B810", color: "#0F56B8", fontWeight: 600 }}>👤 {u.firstName}</span>)}</div>}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><strong style={{ fontSize: 16, color: "#1E3A5F" }}>{Number(currentValue || 0).toLocaleString("fr-FR")}</strong><span style={{ fontSize: 12, color: "#6B7280" }}>/ {Number(o.target || 0).toLocaleString("fr-FR")} {o.unit}</span><span style={{ fontSize: 13, fontWeight: 700, color: p >= 80 ? "#10B981" : p >= 50 ? "#F59E0B" : "#EF4444", marginLeft: "auto" }}>{p}%</span></div>
                <ProgressBar value={p} max={100} height={10} />
                {o.baseline !== undefined && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 9, color: "#94A3B8" }}><span>Départ : {Number(o.baseline || 0).toLocaleString("fr-FR")}</span><span>Cible : {Number(o.target || 0).toLocaleString("fr-FR")}</span></div>}
                {isAssignee(o) && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 6, fontStyle: "italic" }}>Assigné par {users.find(u => String(u.id) === String(o.owner))?.firstName || "admin"} — suivi en lecture seule</div>}
                {isAdmin && !isDirector && !isOver && status !== "scheduled" && <div style={{ display: "flex", gap: 6, marginTop: 10 }}><Btn small color="#10B981" onClick={() => setStatus(o.id, "success")}>✓ Réussi</Btn><Btn small color="#F59E0B" onClick={() => setStatus(o.id, "postponed")}>↻ Reporter</Btn><Btn small color="#EF4444" onClick={() => setStatus(o.id, "failed")}>✕ Raté</Btn></div>}
                {isAdmin && !isDirector && isOver && <Btn small outline color="#6B7280" onClick={() => setStatus(o.id, "active")} style={{ marginTop: 10 }}>Réactiver</Btn>}
              </div>
            </Card>
          );
        })}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier l'objectif" : "Nouvel objectif"}>
        <Input label="Titre" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} />
        <Select label="Club" value={form.club} onChange={v => { const current = getMetricValue(v, form.metricKey); setForm(p => ({ ...p, club: v, current, baseline: editing ? p.baseline : current, assignedTo: memberIdsForClub(v) })); }} options={clubs.map(c => ({ value: String(c.id), label: c.name }))} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Input label="Date de début" value={form.startDate} onChange={v => setForm(p => ({ ...p, startDate: v }))} type="date" /><Input label="Date limite" value={form.deadline} onChange={v => setForm(p => ({ ...p, deadline: v }))} type="date" /></div>
        <Select label="Indicateur Metricool" value={form.metricKey} onChange={v => { const metric = metricOptions.find(item => item.key === v); const current = getMetricValue(form.club, v); setForm(p => ({ ...p, metricKey: v, unit: metric?.unit || "", current, baseline: editing ? p.baseline : current })); }} options={metricOptions.map(metric => ({ value: metric.key, label: metric.label }))} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}><Input label="Valeur de départ" value={Number(form.baseline || 0)} onChange={() => {}} type="number" disabled /><Input label="Cible" value={form.target} onChange={v => setForm(p => ({ ...p, target: Number(v) }))} type="number" /><Input label="Actuel · Metricool" value={getMetricValue(form.club, form.metricKey)} onChange={() => {}} type="number" disabled /></div>
        {/* Membres du club assignés automatiquement */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 3 }}>Assigné automatiquement aux membres du club</label>
          <div style={{ fontSize: 9, color: "#94A3B8", marginBottom: 7 }}>La liste suit automatiquement les rattachements définis dans le répertoire.</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {users.filter(u => (u.clubs || []).some(clubId => String(clubId) === String(form.club))).map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, border: "1.5px solid #0F56B830", background: "#0F56B810" }}>
                <Avatar name={`${u.firstName} ${u.lastName}`} size={20} color={["#6366F1","#EC4899","#10B981","#F59E0B"][u.id % 4]} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#0F56B8" }}>{u.firstName}</span><span style={{ fontSize: 10, color: "#0F56B8" }}>✓</span>
              </div>
            ))}
            {users.filter(u => (u.clubs || []).some(clubId => String(clubId) === String(form.club))).length === 0 && <div style={{ fontSize: 11, color: "#94A3B8", padding: 8 }}>Aucun membre rattaché à ce club.</div>}
          </div>
        </div>
        {form.title && (() => { const current = getMetricValue(form.club, form.metricKey); const start = Number(form.baseline || 0); const target = Number(form.target || 0); const progress = target > start ? Math.max(0, Math.min(100, Math.round(((current - start) / (target - start)) * 100))) : 0; return <Card style={{ background: "#F4F2EF", marginBottom: 14, padding: 14 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>Aperçu · synchronisé Metricool</div><div style={{ fontSize: 14, fontWeight: 700 }}>{form.title}</div><div style={{ fontSize: 12, color: "#6B7280" }}>{current.toLocaleString("fr-FR")} / {target.toLocaleString("fr-FR")} {form.unit} — {progress}%</div><ProgressBar value={progress} max={100} height={8} /></Card>; })()}
        <Btn onClick={save}>Enregistrer</Btn>
      </Modal>
    </div>
  );
}

// ==================== TODO PAGE ====================
function TodoPage({ clubs, tasks, setTasks, meetings, setMeetings, slots, setSlots, users, addToast, projects, currentUserId, isAdmin, isDirector, currentUser }) {
  const [tab, setTab] = useState("todo");
  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 700 }}>Tâches & Planning</h2>
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>{["todo","reunions"].map(t => (<button key={t} onClick={() => setTab(t)} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: tab === t ? "#0F56B8" : "#F1F5F9", color: tab === t ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t === "todo" ? "To-Do" : "Réunions"}</button>))}</div>
      {tab === "todo" && <KanbanBoard clubs={clubs} tasks={tasks} setTasks={setTasks} users={users} projects={projects} currentUserId={currentUserId} isAdmin={isAdmin} isDirector={isDirector} currentUser={currentUser} addToast={addToast} />}
      {tab === "reunions" && <MeetingsTab clubs={clubs} meetings={meetings} setMeetings={setMeetings} slots={slots} setSlots={setSlots} users={users} addToast={addToast} currentUserId={currentUserId} isAdmin={isAdmin} />}
    </div>
  );
}

function KanbanBoard({ clubs, tasks, setTasks, users, projects, currentUserId, isAdmin, isDirector, currentUser, addToast }) {
  const [clubFilter, setClubFilter] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", clubs: [], deadline: "", urgency: "Normal", assignee: "", assigneeId: null, assignedTo: [], status: "À faire", recurrence: "Aucune", projectId: null });
  const [expanded, setExpanded] = useState({});
  const [showAllTasks, setShowAllTasks] = useState(false);
  const dragItem = useRef(null);
  const myOwnTasks = tasks.filter(t => String(t.assigneeId) === String(currentUserId) || String(t.owner) === String(currentUserId) || (t.assignedTo || []).some(a => String(a) === String(currentUserId)));
  // Directors see all tasks from users in their clubs
  const directorClubIds = (currentUser?.clubs || []).map(String);
  const clubMemberIds = isDirector ? users.filter(u => (u.clubs || []).some(c => directorClubIds.includes(String(c)))).map(u => String(u.id)) : [];
  const directorTasks = isDirector ? tasks.filter(t => (t.assignedTo || []).some(a => clubMemberIds.includes(String(a))) || clubMemberIds.includes(String(t.owner))) : [];
  const myTasks = isAdmin && showAllTasks ? tasks : isDirector ? directorTasks : myOwnTasks;
  const filtered = myTasks.filter(t => !clubFilter || (t.clubs || (t.club ? [t.club] : [])).some(x => String(x) === String(clubFilter)));
  const openNew = (status = "À faire") => { setEditing(null); setForm({ title: "", clubs: [], deadline: "", urgency: "Normal", assignee: "", assigneeId: null, assignedTo: [], status, recurrence: "Aucune", projectId: null }); setModalOpen(true); };
  const openEdit = (t) => { setEditing(t.id); setForm({ title: t.title, clubs: t.clubs || (t.club ? [t.club] : []), deadline: t.deadline, urgency: t.urgency, assignee: t.assignee, assigneeId: t.assigneeId, assignedTo: t.assignedTo || [], status: t.status, recurrence: t.recurrence, projectId: t.projectId }); setModalOpen(true); };
  const save = () => { if (!form.title) return; if (editing) { setTasks(p => p.map(t => String(t.id) === String(editing) ? { ...t, ...form } : t)); (form.assignedTo || []).forEach(uid2 => { const u = users.find(x => String(x.id) === String(uid2)); if (u) addToast({ title: `☑ Tâche modifiée : ${form.title}`, icon: "✏️", badges: [u.firstName, "Modifié"], target: "todo", notifType: "TASK_UPDATED" }, [uid2]); }); } else { const assignedTo = form.assignedTo && form.assignedTo.length > 0 ? form.assignedTo : [currentUserId]; const finalForm = { ...form, assignedTo }; setTasks(p => [...p, { id: uid(), ...finalForm, subtasks: [], notes: [], owner: currentUserId }]); if (addToast) { addToast({ title: `Nouvelle tâche : ${finalForm.title}`, icon: "☑", badges: [finalForm.assignee || "Non assigné"], target: "todo" }); assignedTo.filter(uid2 => String(uid2) !== String(currentUserId)).forEach(uid2 => { const u = users.find(x => String(x.id) === String(uid2)); if (u) addToast({ title: `☑ Tâche assignée : ${finalForm.title}`, icon: "☑", badges: [u.firstName, "Assigné"], target: "todo", notifType: "TASK_ASSIGNED" }, [uid2]); }); } } setModalOpen(false); };
  const del = (id) => setTasks(p => p.filter(t => String(t.id) !== String(id)));
  const canModifyTask = (t) => isAdmin || String(t.owner) === String(currentUserId) || (t.assignedTo || []).some(a => String(a) === String(currentUserId));
  const moveTask = (id, newStatus) => { const t = tasks.find(x => String(x.id) === String(id)); if (t && !canModifyTask(t)) return; setTasks(p => p.map(t => String(t.id) === String(id) ? { ...t, status: newStatus } : t)); };
  const toggleSubtask = (tid, sid) => setTasks(p => p.map(t => String(t.id) === String(tid) ? { ...t, subtasks: t.subtasks.map(s => String(s.id) === String(sid) ? { ...s, done: !s.done } : s) } : t));
  const addSubtask = (tid, text) => { if (!text) return; setTasks(p => p.map(t => String(t.id) === String(tid) ? { ...t, subtasks: [...t.subtasks, { id: uid(), text, done: false }] } : t)); };
  const delSubtask = (tid, sid) => setTasks(p => p.map(t => String(t.id) === String(tid) ? { ...t, subtasks: t.subtasks.filter(s => String(s.id) !== String(sid)) } : t));
  const addNote = (tid, text, type) => { if (!text) return; setTasks(p => p.map(t => String(t.id) === String(tid) ? { ...t, notes: [...t.notes, { id: uid(), text, type }] } : t)); };
  const delNote = (tid, nid) => setTasks(p => p.map(t => String(t.id) === String(tid) ? { ...t, notes: t.notes.filter(n => String(n.id) !== String(nid)) } : t));
  const [newSubtask, setNewSubtask] = useState({});
  const [newNote, setNewNote] = useState({});

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <ClubFilter clubs={clubs} selected={clubFilter} onChange={setClubFilter} />
        {isAdmin && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, color: showAllTasks ? "#0F56B8" : "#6B7280" }}>
            <input type="checkbox" checked={showAllTasks} onChange={e => setShowAllTasks(e.target.checked)} style={{ accentColor: "#0F56B8", width: 16, height: 16 }} />
            Voir toutes les tâches
          </label>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {STATUS_TYPES.map(status => {
          const col = filtered.filter(t => t.status === status).sort((a, b) => a.deadline.localeCompare(b.deadline));
          return (
            <div key={status} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragItem.current) { moveTask(dragItem.current, status); dragItem.current = null; } }} style={{ background: "#F4F2EF", borderRadius: 14, padding: 14, minHeight: 300 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30" }}>{status}</span><span style={{ fontSize: 11, background: "#E2E8F0", padding: "1px 8px", borderRadius: 10, fontWeight: 600 }}>{col.length}</span></div><button onClick={() => openNew(status)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94A3B8" }}>+</button></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {col.map(t => {
                  const proj = projects.find(p => String(p.id) === String(t.projectId));
                  return (
                  <div key={t.id} draggable={canModifyTask(t)} onDragStart={() => { if (canModifyTask(t)) dragItem.current = t.id; }}>
                    <Card style={{ padding: 12, cursor: "grab", borderLeft: `3px solid ${URGENCY_COLORS[t.urgency]}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}><div style={{ fontSize: 13, fontWeight: 600, color: "#2D2D30", flex: 1 }}>{t.title}</div><div style={{ display: "flex", gap: 2 }}><button onClick={() => openEdit(t)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>✏️</button><button onClick={() => del(t.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>🗑️</button></div></div>
                      <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                        {(t.clubs || (t.club ? [t.club] : [])).map(cid => <ClubBadge key={cid} clubId={cid} clubs={clubs} />)}<Badge text={t.urgency} color={URGENCY_COLORS[t.urgency]} small />{t.recurrence !== "Aucune" && <Badge text={`🔄 ${t.recurrence}`} color="#FEB601" small />}
                        {proj && <Badge text={`📂 ${proj.name}`} color="#0F56B8" small />}
                      </div>
                      <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4 }}>{(t.assignedTo || []).length > 0 ? (t.assignedTo || []).map(uid2 => users.find(u => String(u.id) === String(uid2))?.firstName).filter(Boolean).join(", ") : t.assignee || "Non assigné"} · {t.deadline}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 10, color: "#6B7280" }}>{t.subtasks.length > 0 && <span>☑ {t.subtasks.filter(s => s.done).length}/{t.subtasks.length}</span>}{t.notes.length > 0 && <span>📝 {t.notes.length}</span>}</div>
                      <button onClick={() => setExpanded(p => ({ ...p, [t.id]: !p[t.id] }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#0F56B8", marginTop: 4, padding: 0, fontFamily: "inherit" }}>{expanded[t.id] ? "▲ Replier" : "▼ Déplier"}</button>
                      {expanded[t.id] && (
                        <div style={{ marginTop: 8, borderTop: "1px solid #E2E8F0", paddingTop: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>Sous-tâches</div>
                          {t.subtasks.map(s => (<div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}><input type="checkbox" checked={s.done} onChange={() => toggleSubtask(t.id, s.id)} style={{ accentColor: "#10B981" }} /><span style={{ fontSize: 11, textDecoration: s.done ? "line-through" : "none", color: s.done ? "#94A3B8" : "#334155", flex: 1 }}>{s.text}</span><button onClick={() => delSubtask(t.id, s.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#EF4444" }}>✕</button></div>))}
                          <div style={{ display: "flex", gap: 4, marginTop: 4 }}><input value={newSubtask[t.id] || ""} onChange={e => setNewSubtask(p => ({ ...p, [t.id]: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") { addSubtask(t.id, newSubtask[t.id]); setNewSubtask(p => ({ ...p, [t.id]: "" })); } }} placeholder="Ajouter..." style={{ flex: 1, padding: "3px 6px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }} /><button onClick={() => { addSubtask(t.id, newSubtask[t.id]); setNewSubtask(p => ({ ...p, [t.id]: "" })); }} style={{ background: "#0F56B8", color: "#fff", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>+</button></div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginTop: 10, marginBottom: 4 }}>Notes / Suivi</div>
                          {t.notes.map(n => (<div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6, padding: 8, background: "#F4F2EF", borderRadius: 6 }}><span style={{ fontSize: 12 }}>{n.type === "done" ? "✅" : n.type === "info" ? "📝" : "⏳"}</span><span style={{ fontSize: 11, color: "#334155", flex: 1, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{n.text}</span><button onClick={() => delNote(t.id, n.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#EF4444" }}>✕</button></div>))}
                          <div style={{ marginTop: 4 }}><textarea value={newNote[t.id] || ""} onChange={e => setNewNote(p => ({ ...p, [t.id]: e.target.value }))} placeholder="Écrire une note sur cette tâche..." rows={2} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} /><div style={{ display: "flex", gap: 4, marginTop: 4 }}><button onClick={() => { addNote(t.id, newNote[t.id], "done"); setNewNote(p => ({ ...p, [t.id]: "" })); }} style={{ background: "#10B981", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>✅ Fait</button><button onClick={() => { addNote(t.id, newNote[t.id], "wait"); setNewNote(p => ({ ...p, [t.id]: "" })); }} style={{ background: "#F59E0B", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>⏳ En cours</button><button onClick={() => { addNote(t.id, newNote[t.id], "info"); setNewNote(p => ({ ...p, [t.id]: "" })); }} style={{ background: "#0F56B8", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>📝 Note</button></div></div>
                        </div>
                      )}
                    </Card>
                  </div>
                );})}
              </div>
            </div>
          );
        })}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier la tâche" : "Nouvelle tâche"}>
        <Input label="Titre" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} />
        <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Clubs</label><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{clubs.map(c => (<button key={c.id} onClick={() => setForm(p => ({ ...p, clubs: (p.clubs || []).some(x => String(x) === String(c.id)) ? (p.clubs || []).filter(x => String(x) !== String(c.id)) : [...(p.clubs || []), c.id] }))} style={{ padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${(form.clubs || []).some(x => String(x) === String(c.id)) ? c.color : "#E2E8F0"}`, background: (form.clubs || []).some(x => String(x) === String(c.id)) ? c.color + "15" : "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, color: (form.clubs || []).some(x => String(x) === String(c.id)) ? c.color : "#6B7280", fontFamily: "inherit" }}>{c.name}{(form.clubs || []).some(x => String(x) === String(c.id)) && " ✓"}</button>))}</div></div>
        <Input label="Date limite" value={form.deadline} onChange={v => setForm(p => ({ ...p, deadline: v }))} type="date" />
        <Select label="Urgence" value={form.urgency} onChange={v => setForm(p => ({ ...p, urgency: v }))} options={["Urgent", "Normal", "Bas"]} />
        {/* Multi-assign */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Assigner à</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {users.map(u => (
              <button key={u.id} onClick={() => setForm(p => { const cur = p.assignedTo || []; const has = cur.includes(u.id); return { ...p, assignedTo: has ? cur.filter(x => x !== u.id) : [...cur, u.id], assigneeId: has ? (cur.length > 1 ? cur.find(x => x !== u.id) : null) : u.id, assignee: has ? "" : `${u.firstName} ${u.lastName[0]}.` }; })} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${(form.assignedTo || []).includes(u.id) ? "#0F56B8" : "#E2E8F0"}`, background: (form.assignedTo || []).includes(u.id) ? "#0F56B810" : "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                <Avatar name={`${u.firstName} ${u.lastName}`} size={20} color={["#6366F1","#EC4899","#10B981","#F59E0B"][u.id % 4]} />
                <span style={{ fontSize: 11, fontWeight: 600, color: (form.assignedTo || []).includes(u.id) ? "#0F56B8" : "#6B7280" }}>{u.firstName}</span>
                {(form.assignedTo || []).includes(u.id) && <span style={{ fontSize: 10, color: "#0F56B8" }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
        <Select label="Récurrence" value={form.recurrence} onChange={v => setForm(p => ({ ...p, recurrence: v }))} options={["Aucune", "Quotidienne", "Hebdomadaire", "Bi-mensuelle", "Mensuelle"]} />
        <Select label="Projet" value={form.projectId || ""} onChange={v => setForm(p => ({ ...p, projectId: v ? Number(v) : null }))} options={[{ value: "", label: "— Aucun projet —" }, ...projects.map(pr => ({ value: pr.id, label: pr.name }))]} />
        <Btn onClick={save}>Enregistrer</Btn>
      </Modal>
    </div>
  );
}

function MeetingsTab({ clubs, meetings, setMeetings, slots, setSlots, users, addToast, currentUserId, isAdmin }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", date: "", time: "10:00", duration: "1h", location: "", type: "Présentiel", participants: [], club: 1, link: "", notesBefore: "", notesAfter: "" });
  const [expandedMeeting, setExpandedMeeting] = useState({});
  const [slotModal, setSlotModal] = useState(false);
  const [slotForm, setSlotForm] = useState({ date: "", time: "09:00", duration: "30min", mode: "Visio" });
  const [bulkDate, setBulkDate] = useState("");
  const openNew = () => { setEditing(null); setForm({ title: "", date: "", time: "10:00", duration: "1h", location: "", type: "Présentiel", participants: [], club: clubs[0]?.id || 1, link: "", notesBefore: "", notesAfter: "" }); setModalOpen(true); };
  const openEdit = (m) => { setEditing(m.id); setForm({ ...m }); setModalOpen(true); };
  const save = () => { if (!form.title) return; if (editing) setMeetings(p => p.map(m => String(m.id) === String(editing) ? { ...m, ...form } : m)); else setMeetings(p => [...p, { id: uid(), ...form }]); setModalOpen(false); };
  const del = (id) => setMeetings(p => p.filter(m => String(m.id) !== String(id)));
  const updateNotes = (id, field, val) => setMeetings(p => p.map(m => String(m.id) === String(id) ? { ...m, [field]: val } : m));
  const addSlot = () => { if (!slotForm.date) return; setSlots(p => [...p, { id: uid(), ...slotForm, reserved: false, contact: "", contactPhone: "" }]); setSlotModal(false); };
  const delSlot = (id) => { const slot = slots.find(s => String(s.id) === String(id)); if (slot?.reserved) { setMeetings(p => p.filter(m => !(m.title === `Créneau — ${slot.contact}` && m.date === slot.date))); addToast({ title: `Créneau libéré — ${slot.contact}`, icon: "🗑️", badges: ["Notification"], target: "todo" }); } setSlots(p => p.filter(s => String(s.id) !== String(id))); };

  const reserveSlot = (id, contact, phone) => {
    if (!contact) return;
    const slot = slots.find(s => String(s.id) === String(id));
    setSlots(p => p.map(s => String(s.id) === String(id) ? { ...s, reserved: true, contact, contactPhone: phone || "", reservedBy: currentUserId } : s));
    if (slot) {
      setMeetings(p => [...p, { id: uid(), title: `Créneau — ${contact}`, date: slot.date, time: slot.time, duration: slot.duration, location: slot.mode === "Visio" ? "Visio" : "Téléphone", type: slot.mode === "Visio" ? "Visio" : "Présentiel", participants: [currentUserId, 1], club: 1, link: "", notesBefore: "", notesAfter: "" }]);
      addToast({ title: `Créneau pris — ${slot.date} à ${slot.time}`, icon: "📅", badges: ["Créneau pris"], target: "todo" });
      // Notify admin (user ID 1) about the booking
      const me = users.find(u => String(u.id) === String(currentUserId));
      addToast({ title: `📅 RDV pris par ${me?.firstName || contact} — ${slot.date} à ${slot.time} (${slot.mode})`, icon: "📅", badges: [contact, slot.date], target: "todo", notifType: "MEETING_BOOKED" }, [1]);
    }
  };
  const freeSlot = (id) => {
    const slot = slots.find(s => String(s.id) === String(id));
    if (slot) { setMeetings(p => p.filter(m => !(m.title === `Créneau — ${slot.contact}` && m.date === slot.date))); addToast({ title: `Créneau libéré — ${slot.contact}`, icon: "🔓", badges: ["Créneau libéré"], target: "todo" }); }
    setSlots(p => p.map(s => String(s.id) === String(id) ? { ...s, reserved: false, contact: "", contactPhone: "" } : s));
  };
  const openBulk = () => { if (!bulkDate) return; const times = ["09:00","09:30","10:00","10:30","11:00","11:30","14:00","14:30","15:00","15:30","16:00","16:30"]; const newSlots = times.map(t => ({ id: uid(), date: bulkDate, time: t, duration: "30min", mode: "Visio", reserved: false, contact: "", contactPhone: "" })); setSlots(p => [...p, ...newSlots]); };
  const deletePast = () => { const today = new Date().toISOString().split("T")[0]; setSlots(p => p.filter(s => s.date >= today)); };
  const [slotContacts, setSlotContacts] = useState({});
  const [slotPhones, setSlotPhones] = useState({});
  const today = new Date().toISOString().split("T")[0];

  // Group slots by date
  const slotsByDate = {};
  slots.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).forEach(s => { (slotsByDate[s.date] = slotsByDate[s.date] || []).push(s); });

  const myMeetings = isAdmin ? meetings : meetings.filter(m => m.participants.includes(currentUserId));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Réunions</h3><Btn onClick={openNew} small>+ Nouvelle réunion</Btn></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 30 }}>
        {myMeetings.sort((a, b) => a.date.localeCompare(b.date)).map(m => (
          <Card key={m.id} style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30" }}>{m.title}</span><span>{m.type === "Visio" ? "💻" : "📍"}</span><ClubBadge clubId={m.club} clubs={clubs} /></div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>{m.date} · {m.time} · {m.duration} · {m.location}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}><AvatarStack ids={m.participants} users={users} size={24} />{m.link && <a href={m.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 600, color: "#0F56B8", textDecoration: "none" }}>Rejoindre →</a>}</div>
              </div>
              <div style={{ display: "flex", gap: 4 }}><button onClick={() => setExpandedMeeting(p => ({ ...p, [m.id]: !p[m.id] }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>📝</button><button onClick={() => openEdit(m)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>✏️</button><button onClick={() => del(m.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>🗑️</button></div>
            </div>
            {expandedMeeting[m.id] && <div style={{ marginTop: 10, borderTop: "1px solid #E2E8F0", paddingTop: 10 }}><Textarea label="Notes avant" value={m.notesBefore} onChange={v => updateNotes(m.id, "notesBefore", v)} rows={2} /><Textarea label="Notes après" value={m.notesAfter} onChange={v => updateNotes(m.id, "notesAfter", v)} rows={2} /></div>}
          </Card>
        ))}
        {meetings.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "#94A3B8", fontSize: 13 }}>Aucune réunion</div>}
      </div>

      <div style={{ borderTop: "2px solid #E2E8F0", paddingTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Créneaux de disponibilité</h3>{isAdmin && <div style={{ display: "flex", gap: 6 }}><Btn onClick={() => setSlotModal(true)} small>+ Ouvrir un créneau</Btn><Btn onClick={deletePast} small outline color="#EF4444">Supprimer passés</Btn></div>}</div>
        {isAdmin && <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14 }}><input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} style={{ padding: "5px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit" }} /><Btn onClick={openBulk} small outline>Ouvrir tous les créneaux de cette date</Btn></div>}

        {Object.entries(slotsByDate).map(([date, dateSlots]) => {
          const isPast = date < today;
          return (
            <div key={date} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: isPast ? "#94A3B8" : "#2D2D30", marginBottom: 8, padding: "4px 0", borderBottom: "1px solid #E2E8F0" }}>{date} {isPast && "(passé)"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {dateSlots.map(s => (
                  <div key={s.id} style={{ background: s.reserved ? "#F0FDF4" : "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: 10, width: 220, opacity: isPast ? 0.5 : 1, flexShrink: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>{s.time}</span>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: "#6B7280" }}>{s.duration} · {s.mode === "Les deux" ? "📞💻" : s.mode === "Visio" ? "💻" : "📞"}</span>
                        {isAdmin && <button onClick={() => delSlot(s.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#EF4444" }}>✕</button>}
                      </div>
                    </div>
                    {s.reserved ? (
                      isAdmin ? (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#10B981" }}>✓ {s.contact}</div>
                          {s.contactPhone && <div style={{ fontSize: 10, color: "#6B7280" }}>📞 {s.contactPhone}</div>}
                          <Btn onClick={() => freeSlot(s.id)} small outline color="#EF4444" style={{ marginTop: 4 }}>Libérer</Btn>
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8" }}>Créneau pris</div>
                      )
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <input value={slotContacts[s.id] || ""} onChange={e => setSlotContacts(p => ({ ...p, [s.id]: e.target.value }))} placeholder="Prénom Nom" style={{ padding: "3px 6px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 10, fontFamily: "inherit" }} />
                        <input value={slotPhones[s.id] || ""} onChange={e => setSlotPhones(p => ({ ...p, [s.id]: e.target.value }))} placeholder="Téléphone" style={{ padding: "3px 6px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 10, fontFamily: "inherit" }} />
                        <Btn onClick={() => { reserveSlot(s.id, slotContacts[s.id], slotPhones[s.id]); setSlotContacts(p => ({ ...p, [s.id]: "" })); setSlotPhones(p => ({ ...p, [s.id]: "" })); }} small color="#10B981">Réserver</Btn>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier la réunion" : "Nouvelle réunion"}>
        <Input label="Titre" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Input label="Date" value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} type="date" /><Input label="Heure" value={form.time} onChange={v => setForm(p => ({ ...p, time: v }))} type="time" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Select label="Durée" value={form.duration} onChange={v => setForm(p => ({ ...p, duration: v }))} options={["15min","30min","45min","1h","1h30","2h"]} /><Select label="Type" value={form.type} onChange={v => setForm(p => ({ ...p, type: v }))} options={["Présentiel","Visio"]} /></div>
        <Input label="Lieu" value={form.location} onChange={v => setForm(p => ({ ...p, location: v }))} />
        <Input label="Lien visio" value={form.link} onChange={v => setForm(p => ({ ...p, link: v }))} />
        <Select label="Club" value={form.club} onChange={v => setForm(p => ({ ...p, club: v }))} options={clubs.map(c => ({ value: String(c.id), label: c.name }))} />
        <Btn onClick={save}>Enregistrer</Btn>
      </Modal>
      <Modal open={slotModal} onClose={() => setSlotModal(false)} title="Ouvrir un créneau">
        <Input label="Date" value={slotForm.date} onChange={v => setSlotForm(p => ({ ...p, date: v }))} type="date" />
        <Input label="Heure" value={slotForm.time} onChange={v => setSlotForm(p => ({ ...p, time: v }))} type="time" />
        <Select label="Durée" value={slotForm.duration} onChange={v => setSlotForm(p => ({ ...p, duration: v }))} options={["15min","30min","45min","1h"]} />
        <Select label="Mode" value={slotForm.mode} onChange={v => setSlotForm(p => ({ ...p, mode: v }))} options={["Visio","Téléphone","Les deux"]} />
        <Btn onClick={addSlot}>Ouvrir</Btn>
      </Modal>
    </div>
  );
}

// ==================== PROJECTS (FULL CRUD) ====================
function ProjectsPage({ clubs, users, projects, setProjects, tasks, setTasks, currentUserId, isAdmin, addToast, notifyUser }) {
  const [clubFilter, setClubFilter] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", club: 1, status: "Planification", members: [], deadline: "", description: "" });
  const [openProject, setOpenProject] = useState(null); // project detail view
  const [detailTab, setDetailTab] = useState("tasks"); // tasks | context | chat
  const [taskModal, setTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", deadline: "", urgency: "Normal", assigneeId: null, assignee: "" });
  const [chatInput, setChatInput] = useState("");
  const [contextEdit, setContextEdit] = useState(false);
  const [contextDraft, setContextDraft] = useState("");
  const projFileRef = useRef(null);
  const [projDragOver, setProjDragOver] = useState(false);

  const myProjects = projects.filter(p => p.members.includes(currentUserId) || String(p.owner) === String(currentUserId));
  const filtered = myProjects.filter(p => !clubFilter || p.club === clubFilter);
  const statusColors = { "Planification": "#F59E0B", "En cours": "#0F56B8", "Terminé": "#10B981" };

  const openNew = () => { setEditing(null); setForm({ name: "", club: clubs[0]?.id || 1, status: "Planification", members: [], deadline: "", description: "" }); setModalOpen(true); };
  const openEdit = (p) => { setEditing(p.id); setForm({ name: p.name, club: p.club, status: p.status, members: p.members, deadline: p.deadline, description: p.description }); setModalOpen(true); };
  const save = () => {
    if (!form.name) return;
    if (editing) setProjects(pr => pr.map(p => String(p.id) === String(editing) ? { ...p, ...form } : p));
    else { setProjects(pr => [...pr, { id: uid(), ...form, context: "", chat: [], files: [], owner: currentUserId }]); addToast({ title: `Nouveau projet : ${form.name}`, icon: "📂", badges: ["Projet créé"], target: "projects" }); }
    setModalOpen(false);
  };
  const del = (id) => { setProjects(pr => pr.filter(p => String(p.id) !== String(id))); setTasks(ts => ts.map(t => t.projectId === id ? { ...t, projectId: null } : t)); if (openProject === id) setOpenProject(null); };
  const toggleMember = (uid) => setForm(p => ({ ...p, members: p.members.includes(uid) ? p.members.filter(x => x !== uid) : [...p.members, uid] }));

  const getProjectTasks = (pid) => tasks.filter(t => t.projectId === pid);
  const getProgress = (pid) => { const pts = getProjectTasks(pid); if (pts.length === 0) return 0; return Math.round((pts.filter(t => t.status === "Terminé").length / pts.length) * 100); };

  // Add task to project
  const addProjectTask = (pid) => {
    if (!taskForm.title) return;
    const proj = projects.find(p => String(p.id) === String(pid));
    if (proj) { (proj.members || []).filter(m => m !== currentUserId).forEach(m => { notifyUser(m, { title: `📂 Fichier ajouté dans "${proj.name}" : ${file.name}`, icon: "📂", badges: [proj.name], target: "projects" }, "PROJECT_UPDATE"); }); }
    setTasks(ts => [...ts, { id: uid(), title: taskForm.title, club: proj?.club || 1, deadline: taskForm.deadline, urgency: taskForm.urgency, assignee: taskForm.assignee, assigneeId: taskForm.assigneeId, status: "À faire", recurrence: "Aucune", projectId: pid, subtasks: [], notes: [], owner: currentUserId }]);
    addToast({ title: `Tâche assignée : ${taskForm.title}`, icon: "☑", badges: [taskForm.assignee || "Non assigné", proj?.name || ""], target: "projects" });
    setTaskModal(false);
    setTaskForm({ title: "", deadline: "", urgency: "Normal", assigneeId: null, assignee: "" });
  };

  // Delete task
  const delTask = (tid) => setTasks(ts => ts.filter(t => String(t.id) !== String(tid)));

  // Toggle task status
  const cycleStatus = (tid) => {
    setTasks(ts => ts.map(t => {
      if (String(t.id) !== String(tid)) return t;
      const next = t.status === "À faire" ? "En cours" : t.status === "En cours" ? "Terminé" : "À faire";
      return { ...t, status: next };
    }));
  };

  // Chat
  const sendChat = (pid) => {
    if (!chatInput.trim()) return;
    const proj = projects.find(p => String(p.id) === String(pid));
    setProjects(pr => pr.map(p => String(p.id) === String(pid) ? { ...p, chat: [...(p.chat || []), { id: uid(), userId: CURRENT_USER_ID, text: chatInput.trim(), time: new Date().toLocaleString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) }] } : p));
    if (proj && addToast) addToast({ title: `Message dans ${proj.name}`, icon: "💬", badges: [proj.name], target: "projects" });
    setChatInput("");
  };

  // Context
  const saveContext = (pid) => {
    setProjects(pr => pr.map(p => String(p.id) === String(pid) ? { ...p, context: contextDraft } : p));
    setContextEdit(false);
  };

  // Project file upload
  const projDetectType = (fileName) => {
    const ext = fileName.split(".").pop().toLowerCase();
    if (["pdf"].includes(ext)) return "PDF";
    if (["doc","docx","odt","rtf","txt"].includes(ext)) return "Doc";
    if (["xls","xlsx","csv","ods"].includes(ext)) return "Sheet";
    if (["jpg","jpeg","png","gif","svg","webp"].includes(ext)) return "Image";
    if (["zip","rar","7z","tar","gz"].includes(ext)) return "Zip";
    if (["mp4","mov","avi","mkv","webm"].includes(ext)) return "Video";
    if (["ppt","pptx"].includes(ext)) return "Slides";
    return "Other";
  };
  const projFormatSize = (bytes) => {
    if (bytes < 1024) return bytes + " o";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
    return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
  };
  const projFileIcons = { PDF: "📕", Doc: "📄", Sheet: "📊", Image: "🖼️", Zip: "📦", Video: "🎬", Slides: "📊", Other: "📎" };

  const addProjectFile = (pid, file) => {
    if (!file) return;
    const fileId = uid();
    const newFile = {
      id: fileId,
      name: file.name.replace(/\.[^/.]+$/, ""),
      fileName: file.name,
      fileSize: file.size,
      fileUrl: "",
      type: projDetectType(file.name),
      date: new Date().toISOString().split("T")[0],
      owner: CURRENT_USER_ID,
    };
    setProjects(pr => pr.map(p => String(p.id) === String(pid) ? { ...p, files: [...(p.files || []), newFile] } : p));
    // Upload to Firebase Storage then update URL
    (async () => {
      const url = await uploadToStorage(file, `projects/${pid}/${Date.now()}_${file.name}`);
      setProjects(pr => pr.map(p => String(p.id) === String(pid) ? { ...p, files: (p.files || []).map(f => String(f.id) === String(fileId) ? { ...f, fileUrl: url } : f) } : p));
    })();
    const proj = projects.find(p => String(p.id) === String(pid));
    if (proj && addToast) addToast({ title: `Fichier ajouté dans ${proj.name} : ${file.name}`, icon: "📄", badges: [proj.name], target: "projects" });
  };
  const addProjectFiles = (pid, fileList) => {
    for (let i = 0; i < fileList.length; i++) addProjectFile(pid, fileList[i]);
  };
  const delProjectFile = (pid, fid) => {
    setProjects(pr => pr.map(p => String(p.id) === String(pid) ? { ...p, files: (p.files || []).filter(f => String(f.id) !== String(fid)) } : p));
  };
  const handleProjDrop = (pid, e) => {
    e.preventDefault();
    setProjDragOver(false);
    addProjectFiles(pid, e.dataTransfer.files);
  };

  // Detail view
  const proj = openProject ? projects.find(p => String(p.id) === String(openProject)) : null;

  if (proj) {
    const projTasks = getProjectTasks(proj.id);
    const progress = getProgress(proj.id);
    const projMembers = users.filter(u => proj.members.includes(u.id));

    return (
      <div>
        {/* Back button + header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={() => { setOpenProject(null); setDetailTab("tasks"); }} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#6B7280", fontFamily: "inherit" }}>← Retour</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{proj.name}</h2>
              <Badge text={proj.status} color={statusColors[proj.status]} />
              <ClubBadge clubId={proj.club} clubs={clubs} />
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{proj.description}</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {String(proj.owner) === String(currentUserId) && <button onClick={() => openEdit(proj)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>✏️</button>}
            {String(proj.owner) === String(currentUserId) && <button onClick={() => del(proj.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#EF4444" }}>🗑️</button>}
          </div>
        </div>

        {/* Project summary bar */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20, padding: 16, background: "#fff", borderRadius: 12, border: "1px solid #F1F5F9" }}>
          <AvatarStack ids={proj.members} users={users} size={32} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6B7280" }}><span>{projTasks.length} tâches · {projMembers.length} membres</span><span>Deadline : {proj.deadline}</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ flex: 1 }}><ProgressBar value={progress} max={100} height={10} /></div><span style={{ fontSize: 14, fontWeight: 700, color: statusColors[proj.status] }}>{progress}%</span></div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {[{ id: "tasks", label: `Tâches (${projTasks.length})`, icon: "☑" }, { id: "context", label: "Contexte & Infos", icon: "📋" }, { id: "chat", label: `Discussion (${(proj.chat || []).length})`, icon: "💬" }].map(t => (
            <button key={t.id} onClick={() => setDetailTab(t.id)} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: detailTab === t.id ? "#0F56B8" : "#F1F5F9", color: detailTab === t.id ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {/* TAB: Tasks */}
        {detailTab === "tasks" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Tâches du projet</h3>
              <Btn onClick={() => { setTaskForm({ title: "", deadline: proj.deadline, urgency: "Normal", assigneeId: null, assignee: "" }); setTaskModal(true); }} small>+ Ajouter une tâche</Btn>
            </div>
            {projTasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94A3B8", fontSize: 13 }}>Aucune tâche pour ce projet. Ajoutez-en une !</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {projTasks.sort((a, b) => a.deadline.localeCompare(b.deadline)).map(t => (
                  <Card key={t.id} style={{ padding: 12, borderLeft: `3px solid ${URGENCY_COLORS[t.urgency]}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                        <button onClick={() => cycleStatus(t.id)} style={{ background: t.status === "Terminé" ? "#10B981" : t.status === "En cours" ? "#0F56B8" : "#E2E8F0", border: "none", borderRadius: 6, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", fontSize: 11, fontWeight: 700 }}>
                          {t.status === "Terminé" ? "✓" : t.status === "En cours" ? "●" : ""}
                        </button>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#2D2D30", textDecoration: t.status === "Terminé" ? "line-through" : "none", opacity: t.status === "Terminé" ? 0.6 : 1 }}>{t.title}</div>
                          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>{t.assignee || "Non assigné"} · {t.deadline}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <Badge text={t.urgency} color={URGENCY_COLORS[t.urgency]} small />
                        <Badge text={t.status} color={t.status === "Terminé" ? "#10B981" : t.status === "En cours" ? "#0F56B8" : "#F59E0B"} small />
                        <button onClick={() => delTask(t.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#EF4444" }}>🗑️</button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            {/* Task modal */}
            <Modal open={taskModal} onClose={() => setTaskModal(false)} title="Ajouter une tâche au projet">
              <Input label="Titre de la tâche" value={taskForm.title} onChange={v => setTaskForm(p => ({ ...p, title: v }))} />
              <Input label="Date limite" value={taskForm.deadline} onChange={v => setTaskForm(p => ({ ...p, deadline: v }))} type="date" />
              <Select label="Urgence" value={taskForm.urgency} onChange={v => setTaskForm(p => ({ ...p, urgency: v }))} options={["Urgent","Normal","Bas"]} />
              <Select label="Assigné à" value={taskForm.assigneeId || ""} onChange={v => { const u = users.find(x => String(x.id) === String(Number)(v)); setTaskForm(p => ({ ...p, assigneeId: Number(v), assignee: u ? `${u.firstName} ${u.lastName[0]}.` : "" })); }} options={[{ value: "", label: "— Sélectionner —" }, ...projMembers.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))]} />
              <Btn onClick={() => addProjectTask(proj.id)}>Ajouter</Btn>
            </Modal>
          </div>
        )}

        {/* TAB: Context & Info */}
        {detailTab === "context" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Contexte & Informations</h3>
              {!contextEdit && <Btn onClick={() => { setContextDraft(proj.context || ""); setContextEdit(true); }} small outline>✏️ Modifier</Btn>}
            </div>
            <Card>
              {contextEdit ? (
                <div>
                  <textarea value={contextDraft} onChange={e => setContextDraft(e.target.value)} rows={12} placeholder="Décrivez le contexte du projet, les objectifs, le budget, les contraintes, les liens utiles..." style={{ width: "100%", padding: 14, borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <Btn onClick={() => saveContext(proj.id)}>Enregistrer</Btn>
                    <Btn onClick={() => setContextEdit(false)} outline color="#6B7280">Annuler</Btn>
                  </div>
                </div>
              ) : (
                <div>
                  {proj.context ? (
                    <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{proj.context}</div>
                  ) : (
                    <div style={{ textAlign: "center", padding: 32, color: "#94A3B8" }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                      <div style={{ fontSize: 13 }}>Aucune information pour le moment</div>
                      <Btn onClick={() => { setContextDraft(""); setContextEdit(true); }} small style={{ marginTop: 10 }}>Ajouter du contexte</Btn>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Project Documents */}
            <Card style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#2D2D30" }}>📎 Documents du projet</h4>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>{(proj.files || []).length} fichier{(proj.files || []).length !== 1 ? "s" : ""}</span>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setProjDragOver(true); }}
                onDragLeave={() => setProjDragOver(false)}
                onDrop={e => handleProjDrop(proj.id, e)}
                onClick={() => projFileRef.current?.click()}
                style={{
                  border: `2px dashed ${projDragOver ? "#0F56B8" : "#CBD5E1"}`,
                  borderRadius: 10,
                  padding: 20,
                  textAlign: "center",
                  cursor: "pointer",
                  marginBottom: (proj.files || []).length > 0 ? 14 : 0,
                  background: projDragOver ? "#EFF6FF" : "#FAFBFC",
                  transition: "all .2s ease",
                }}
              >
                <input ref={projFileRef} type="file" multiple style={{ display: "none" }} onChange={e => { addProjectFiles(proj.id, e.target.files); e.target.value = ""; }} />
                <div style={{ fontSize: 24, marginBottom: 4 }}>{projDragOver ? "📥" : "📂"}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: projDragOver ? "#0F56B8" : "#475569" }}>
                  {projDragOver ? "Déposez vos fichiers ici" : "Glissez-déposez des fichiers ici"}
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>ou <span style={{ color: "#0F56B8", fontWeight: 600 }}>cliquez pour parcourir</span> — Plusieurs fichiers acceptés</div>
              </div>

              {/* File list */}
              {(proj.files || []).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(proj.files || []).map(f => {
                    const fOwner = users.find(u => String(u.id) === String(f.owner));
                    const isImage = f.type === "Image" && f.fileUrl;
                    return (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, background: "#F4F2EF", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                        {isImage ? (
                          <img src={f.fileUrl} alt={f.name} style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <span style={{ fontSize: 24, flexShrink: 0 }}>{projFileIcons[f.type] || "📎"}</span>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#2D2D30", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                          <div style={{ fontSize: 10, color: "#94A3B8" }}>
                            {f.fileName} · {projFormatSize(f.fileSize)} · {f.date}
                            {fOwner && ` · ${fOwner.firstName} ${fOwner.lastName[0]}.`}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <Badge text={f.type} color="#475569" small />
                          {f.fileUrl && <a href={f.fileUrl} download={f.fileName} onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: "#0F56B8", fontWeight: 600, textDecoration: "none", padding: "3px 8px", background: "#EFF6FF", borderRadius: 6 }}>⬇ Ouvrir</a>}
                          {String(f.owner) === String(CURRENT_USER_ID) && <button onClick={() => delProjectFile(proj.id, f.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#EF4444" }}>🗑️</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Project info summary */}
            <Card style={{ marginTop: 16 }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#2D2D30" }}>Informations du projet</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ padding: 12, background: "#F4F2EF", borderRadius: 8 }}><div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Statut</div><div style={{ fontSize: 14, fontWeight: 700, color: statusColors[proj.status], marginTop: 2 }}>{proj.status}</div></div>
                <div style={{ padding: 12, background: "#F4F2EF", borderRadius: 8 }}><div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Deadline</div><div style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30", marginTop: 2 }}>{proj.deadline}</div></div>
                <div style={{ padding: 12, background: "#F4F2EF", borderRadius: 8 }}><div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Progression</div><div style={{ fontSize: 14, fontWeight: 700, color: statusColors[proj.status], marginTop: 2 }}>{progress}%</div></div>
                <div style={{ padding: 12, background: "#F4F2EF", borderRadius: 8 }}><div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Membres</div><div style={{ marginTop: 4 }}><AvatarStack ids={proj.members} users={users} size={24} /></div></div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", marginBottom: 6 }}>Équipe</div>
                {projMembers.map(u => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                    <Avatar name={`${u.firstName} ${u.lastName}`} size={24} color={["#6366F1","#EC4899","#10B981","#F59E0B"][u.id % 4]} />
                    <span style={{ fontSize: 12, color: "#2D2D30", fontWeight: 500 }}>{u.firstName} {u.lastName}</span>
                    <span style={{ fontSize: 10, color: "#94A3B8" }}>· {u.role}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* TAB: Chat */}
        {detailTab === "chat" && (
          <div>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>Discussion</h3>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ maxHeight: 420, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {(proj.chat || []).length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#94A3B8" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                    <div style={{ fontSize: 13 }}>Aucun message. Lancez la conversation !</div>
                  </div>
                ) : (
                  (proj.chat || []).map(msg => {
                    const msgUser = users.find(u => String(u.id) === String(msg.userId));
                    const isMe = msg.userId === CURRENT_USER_ID;
                    return (
                      <div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, alignItems: "flex-end" }}>
                        <Avatar name={msgUser ? `${msgUser.firstName} ${msgUser.lastName}` : "?"} size={28} color={["#6366F1","#EC4899","#10B981","#F59E0B"][msg.userId % 4]} />
                        <div style={{ maxWidth: "70%", padding: "10px 14px", borderRadius: 14, background: isMe ? "#0F56B8" : "#F1F5F9", color: isMe ? "#fff" : "#2D2D30", borderBottomRightRadius: isMe ? 4 : 14, borderBottomLeftRadius: isMe ? 14 : 4 }}>
                          {!isMe && <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", marginBottom: 2 }}>{msgUser?.firstName} {msgUser?.lastName}</div>}
                          <div style={{ fontSize: 13, lineHeight: 1.4 }}>{msg.text}</div>
                          <div style={{ fontSize: 9, color: isMe ? "rgba(255,255,255,0.6)" : "#94A3B8", marginTop: 3, textAlign: "right" }}>{msg.time}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {/* Chat input */}
              <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid #F1F5F9", background: "#FAFBFC" }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(proj.id); } }} placeholder="Écrire un message..." style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                <Btn onClick={() => sendChat(proj.id)} disabled={!chatInput.trim()}>Envoyer</Btn>
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // ===== LIST VIEW =====
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Projets</h2><Btn onClick={openNew}>+ Nouveau projet</Btn></div>
      <ClubFilter clubs={clubs} selected={clubFilter} onChange={setClubFilter} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map(p => {
          const projTasks = getProjectTasks(p.id);
          const progress = getProgress(p.id);
          return (
            <Card key={p.id} style={{ padding: 16, cursor: "pointer" }} onClick={() => { setOpenProject(p.id); setDetailTab("tasks"); }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#2D2D30" }}>{p.name}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}><ClubBadge clubId={p.club} clubs={clubs} /><Badge text={p.status} color={statusColors[p.status]} /></div>
                  {p.description && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{p.description}</div>}
                </div>
                <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                  {String(p.owner) === String(currentUserId) && <button onClick={() => openEdit(p)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>✏️</button>}
                  {String(p.owner) === String(currentUserId) && <button onClick={() => del(p.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>🗑️</button>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                <AvatarStack ids={p.members} users={users} />
                <div style={{ flex: 1 }}><ProgressBar value={progress} max={100} height={8} /></div>
                <span style={{ fontSize: 13, fontWeight: 700, color: statusColors[p.status] }}>{progress}%</span>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>Deadline : {p.deadline}</span>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "#6B7280" }}>
                <span>☑ {projTasks.length} tâches</span>
                <span>👥 {p.members.length} membres</span>
                <span>💬 {(p.chat || []).length} messages</span>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#94A3B8", fontSize: 13 }}>Aucun projet</div>}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier le projet" : "Nouveau projet"}>
        <Input label="Nom" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} />
        <Input label="Description" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} />
        <Select label="Club" value={form.club} onChange={v => setForm(p => ({ ...p, club: v }))} options={clubs.map(c => ({ value: String(c.id), label: c.name }))} />
        <Select label="Statut" value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))} options={["Planification","En cours","Terminé"]} />
        <Input label="Deadline" value={form.deadline} onChange={v => setForm(p => ({ ...p, deadline: v }))} type="date" />
        <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Membres</label><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{users.map(u => (<button key={u.id} onClick={() => toggleMember(u.id)} style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${form.members.includes(u.id) ? "#0F56B8" : "#E2E8F0"}`, background: form.members.includes(u.id) ? "#0F56B810" : "transparent", color: form.members.includes(u.id) ? "#0F56B8" : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{u.firstName} {u.lastName}</button>))}</div></div>
        <Btn onClick={save}>Enregistrer</Btn>
      </Modal>
    </div>
  );
}

function MetricoolReportingDetails({ month, clubId, clubColor, scored, monthLabel }) {
  const details = useFirestoreValue(month && clubId ? `ep:reporting-details:${month}:${clubId}` : null, null);
  const [tab, setTab] = useState("publications");
  const [expandedItem, setExpandedItem] = useState(null);
  if (!details) return <Card style={{ marginBottom: 16, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>Les données détaillées Metricool seront disponibles après la première synchronisation automatique.</Card>;

  const summary = details.summary || {};
  const demographics = details.demographics || {};
  const city = [...(demographics.city || [])].sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  const flattenValues = (value, prefix = "") => Object.entries(value || {}).flatMap(([key, item]) => {
    const label = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === "object" && !Array.isArray(item)) return flattenValues(item, label);
    return [[label, Array.isArray(item) ? item.join(", ") : item]];
  });
  const displayScalar = value => {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value).length;
    return value ?? 0;
  };
  const donutColors = ["#F9C74F", "#90BEDE", "#43AA8B", "#F28482", "#B8A1E3", "#F6BD60", "#84A59D", "#F5CAC3"];
  const renderDonut = (title, source, limit = null) => {
    const sorted = [...(source || [])].sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
    const visible = (limit ? sorted.slice(0, limit) : sorted).map(item => ({ ...item, value: Number(item.value || 0) }));
    const visibleTotal = visible.reduce((total, item) => total + item.value, 0);
    const chartItems = [...visible];
    if (limit && visibleTotal < 99.99) chartItems.push({ key: "Autres", value: Math.max(0, 100 - visibleTotal) });
    let cursor = 0;
    const gradient = chartItems.map((item, index) => {
      const start = cursor;
      cursor += item.value;
      return `${donutColors[index % donutColors.length]} ${start}% ${Math.min(cursor, 100)}%`;
    }).join(", ");
    return <div style={{ background: "#F8FAFC", border: "1px solid #EEF2F7", borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 14 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div style={{ width: 150, height: 150, flexShrink: 0, borderRadius: "50%", background: gradient ? `conic-gradient(${gradient})` : "#E5E7EB", position: "relative", boxShadow: "0 8px 22px #1E3A5F12" }}>
          <div style={{ position: "absolute", inset: 30, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}><strong style={{ fontSize: 18 }}>{visible.length}</strong><span style={{ fontSize: 9, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>catégories</span></div>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>{visible.map((item,index) => <div key={item.key || index} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 0", borderBottom: "1px solid #E9EEF5" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: donutColors[index % donutColors.length], flexShrink: 0 }} /><span style={{ flex: 1, fontSize: 11, color: "#4B5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.key}</span><strong style={{ fontSize: 11 }}>{item.value.toLocaleString("fr-FR")}%</strong></div>)}</div>
      </div>
    </div>;
  };
  const renderContentTable = (items, kind) => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead><tr style={{ background: "#1E3A5F", color: "#fff" }}>
          {(kind === "stories" ? ["Date","Contenu","Portée","Impressions","Réponses","Retour","Suivant","Sorties","Détails"] : ["Date","Contenu","Portée","Vues","Interactions","J’aime","Commentaires","Partages","Enregistr.","Engagement","Détails"]).map(h => <th key={h} style={{ padding: "7px 8px", textAlign: h === "Contenu" || h === "Date" ? "left" : "right", whiteSpace: "nowrap" }}>{h}</th>)}
        </tr></thead>
        <tbody>{(items || []).map((item, index) => <React.Fragment key={item.id || index}><tr style={{ borderBottom: "1px solid #F1F5F9" }}>
          <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>{item.date ? new Date(item.date).toLocaleDateString("fr-FR") : "—"}</td>
          <td style={{ padding: "7px 8px", minWidth: 260, maxWidth: 420 }}><a href={item.url || undefined} target="_blank" rel="noreferrer" style={{ color: clubColor, textDecoration: "none", fontWeight: 600 }}>{item.text || "Sans texte"}</a></td>
          <td style={{ padding: "7px 8px", textAlign: "right" }}>{item.reach?.toLocaleString?.() || 0}</td>
          {kind === "stories" ? <>
            <td style={{ padding: "7px 8px", textAlign: "right" }}>{item.impressions?.toLocaleString?.() || 0}</td>
            <td style={{ padding: "7px 8px", textAlign: "right" }}>{item.replies || 0}</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{item.tapsBack || 0}</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{item.tapsForward || 0}</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{item.exits || 0}</td>
          </> : <>
            <td style={{ padding: "7px 8px", textAlign: "right" }}>{item.views?.toLocaleString?.() || 0}</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{item.interactions || 0}</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{item.likes || 0}</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{item.comments || 0}</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{item.shares || 0}</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{item.saved || 0}</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{Number(item.engagement || 0).toFixed(2)}%</td>
          </>}
          <td style={{ padding: "7px 8px", textAlign: "right" }}><button onClick={() => setExpandedItem(expandedItem === `${kind}-${index}` ? null : `${kind}-${index}`)} style={{ border: 0, borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: clubColor, fontWeight: 700 }}>{expandedItem === `${kind}-${index}` ? "Fermer" : "Tout voir"}</button></td>
        </tr>{expandedItem === `${kind}-${index}` && <tr><td colSpan={kind === "stories" ? 9 : 11} style={{ padding: 12, background: "#F8FAFC" }}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 6 }}>{flattenValues(item.raw || item).map(([key,value]) => <div key={key} style={{ padding: 7, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 6, overflowWrap: "anywhere" }}><div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 700 }}>{key}</div><div style={{ fontSize: 11, marginTop: 2 }}>{value === null || value === "" ? "—" : String(value)}</div></div>)}</div></td></tr>}</React.Fragment>)}</tbody>
      </table>
    </div>
  );

  return <>
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div style={{ fontSize: 13, fontWeight: 700 }}>Données — {monthLabel}</div><Badge text={`Synchronisé le ${new Date(details.syncedAt).toLocaleString("fr-FR")}`} color="#10B981" /></div>
      {[
        { title: "Audience", color: "#F9C74F", items: [
          { label: "Abonnés", value: Number(scored?.abonnes || summary.abonnes || 0).toLocaleString("fr-FR") },
          { label: "Évolution abonnés", value: `${Number(summary.evolutionAbonnes || 0) >= 0 ? "+" : ""}${Number(summary.evolutionAbonnes || 0).toLocaleString("fr-FR")}` },
          { label: "Taux d’évolution", value: `${Number(scored?.txEvol || summary.txEvol || 0) > 0 ? "+" : ""}${Number(scored?.txEvol || summary.txEvol || 0).toLocaleString("fr-FR")}%` },
        ]},
        { title: "Contenus publiés", color: "#90BEDE", items: [
          { label: "Publications", value: scored?.publications ?? summary.publications }, { label: "Reels", value: summary.reels }, { label: "Stories", value: scored?.stories ?? summary.stories },
        ]},
        { title: "Visibilité", color: "#B8A1E3", items: [
          { label: "Vues", value: Number(summary.vues || 0).toLocaleString("fr-FR") }, { label: "Impressions stories", value: Number(summary.storiesImpressions || 0).toLocaleString("fr-FR") },
          { label: "Portée moy./Post", value: Number(scored?.porteeMoy || summary.porteeMoy || 0).toLocaleString("fr-FR") }, { label: "Portée moy./Reel", value: Number(summary.porteeMoyReel || 0).toLocaleString("fr-FR") },
          { label: "Portée moy./Story", value: Number(summary.porteeMoyStory || 0).toLocaleString("fr-FR") },
        ]},
        { title: "Interactions", color: "#43AA8B", items: [
          { label: "Interactions", value: Number(scored?.interactions || summary.interactions || 0).toLocaleString("fr-FR") }, { label: "J’aime", value: summary.jaimes },
          { label: "Commentaires", value: summary.commentaires }, { label: "Partages", value: summary.partages }, { label: "Enregistrements", value: summary.enregistrements },
        ]},
        { title: "Performance", color: "#F28482", items: [
          { label: "Engagement", value: `${Number(scored?.engagement || summary.engagement || 0).toFixed(2)}%` }, { label: "Interactions/Post", value: Number(scored?.interPerPost || 0).toFixed(1) },
          { label: "Score global", value: Number(scored?.global || 0).toFixed(2) },
        ]},
      ].map(group => <div key={group.title} style={{ marginTop: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: group.color }} /><div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: ".04em" }}>{group.title}</div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>{group.items.map(item => <div key={item.label} style={{ padding: 12, background: "#F4F2EF", borderRadius: 8, textAlign: "center", borderTop: `3px solid ${group.color}` }}><div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>{item.label}</div><div style={{ fontSize: 18, fontWeight: 800, marginTop: 3 }}>{item.value ?? 0}</div></div>)}</div></div>)}
    </Card>
    <Card style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Données démographiques · état actuel</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(390px, 1fr))", gap: 16 }}>
        {renderDonut("Sexe", demographics.gender)}
        {renderDonut("Âge", demographics.age)}
        {renderDonut("Pays · Top 5", demographics.country, 5)}
        {renderDonut("Abonnés par ville · Top 5", city, 5)}
      </div>
    </Card>
    <Card>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>{[["publications","Publications",details.posts],["hashtags","Hashtags",details.hashtags],["reels","Reels",details.reels],["stories","Stories",details.stories],["followers","Évolution abonnés",details.followersTimeline]].map(([key,label,items]) => <button key={key} onClick={() => setTab(key)} style={{ padding: "6px 12px", border: "none", borderRadius: 7, background: tab === key ? "#1E3A5F" : "#F1F5F9", color: tab === key ? "#fff" : "#6B7280", fontWeight: 600, cursor: "pointer" }}>{label} ({(items || []).length})</button>)}</div>
      {tab === "publications" && renderContentTable(details.posts, "posts")}
      {tab === "reels" && renderContentTable(details.reels, "reels")}
      {tab === "stories" && renderContentTable(details.stories, "stories")}
      {tab === "followers" && <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#1E3A5F", color: "#fff" }}><th style={{ padding: 8, textAlign: "left" }}>Date</th><th style={{ padding: 8, textAlign: "right" }}>Abonnés</th><th style={{ padding: 8, textAlign: "right" }}>Évolution</th></tr></thead><tbody>{(details.followersTimeline || []).map((item,index,list) => { const change = index ? Number(item.value || 0) - Number(list[index - 1]?.value || 0) : null; return <tr key={item.date || index} style={{ borderBottom: "1px solid #F1F5F9" }}><td style={{ padding: 8 }}>{item.date ? new Date(item.date).toLocaleDateString("fr-FR") : "—"}</td><td style={{ padding: 8, textAlign: "right", fontWeight: 700 }}>{Number(item.value || 0).toLocaleString("fr-FR")}</td><td style={{ padding: 8, textAlign: "right", color: change === null || change >= 0 ? "#059669" : "#DC2626" }}>{change === null ? "—" : `${change >= 0 ? "+" : ""}${change}`}</td></tr>; })}</tbody></table></div>}
      {tab === "hashtags" && <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#1E3A5F", color: "#fff" }}>{["Hashtag","Publications","Vues","J’aime","Commentaires"].map(h => <th key={h} style={{ padding: "7px 8px", textAlign: h === "Hashtag" ? "left" : "right" }}>{h}</th>)}</tr></thead><tbody>{(details.hashtags || []).map((item,index) => <tr key={String(item.hashtag || item.key || index)} style={{ borderBottom: "1px solid #F1F5F9" }}><td style={{ padding: "7px 8px", fontWeight: 600, color: clubColor }}>#{String(item.hashtag || item.key || item.filter || "Sans hashtag").replace(/^#/,"")}</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{displayScalar(item.posts || item.count)}</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{displayScalar(item.views || item.impressions)}</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{displayScalar(item.likes)}</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{displayScalar(item.comments)}</td></tr>)}</tbody></table></div>}
    </Card>
  </>;
}

// ==================== REPORTING ====================
function MetricoolApprovalsPage({ approvals }) {
  const items = approvals?.items || [];
  const pending = items.filter(item => item.status === "pending");
  const formatPublicationDate = value => {
    const raw = value?.dateTime || value?.date || value;
    if (!raw) return "Date non renseignée";
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });
  };
  const metricoolUrl = "https://app.metricool.com/my-tasks/open?blogId=4483840&userId=3507262";
  return <div>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Validations Metricool</h1>
        <div style={{ marginTop: 5, color: "#64748B", fontSize: 12 }}>Toutes les publications soumises à l’administrateur avant programmation.</div>
      </div>
      <a href={metricoolUrl} target="_blank" rel="noreferrer" style={{ padding: "11px 18px", borderRadius: 11, background: "#E4405F", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 800 }}>Ouvrir et valider dans Metricool ↗</a>
    </div>
    <div className="responsive-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 20 }}>
      {[
        { label: "En attente", value: pending.length, color: "#F59E0B", icon: "◷" },
        { label: "Clubs concernés", value: new Set(pending.map(item => item.club)).size, color: "#0F56B8", icon: "🏟" },
        { label: "Dernière synchronisation", value: approvals?.syncedAt ? new Date(approvals.syncedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—", color: "#10B981", icon: "↻" },
      ].map(stat => <Card key={stat.label} style={{ padding: 16 }}><div style={{ color: "#94A3B8", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{stat.icon} {stat.label}</div><div style={{ color: stat.color, fontSize: 26, fontWeight: 800, marginTop: 5 }}>{stat.value}</div></Card>)}
    </div>
    {approvals?.ok === false && <Card style={{ padding: 16, marginBottom: 16, border: "1px solid #FECACA", background: "#FEF2F2", color: "#B91C1C", fontSize: 12 }}>La dernière synchronisation Metricool a échoué. Une nouvelle tentative sera effectuée automatiquement sous 5 minutes.</Card>}
    {!pending.length ? <Card style={{ textAlign: "center", padding: 42 }}><div style={{ fontSize: 34 }}>✓</div><div style={{ fontWeight: 800, marginTop: 8 }}>Aucune publication en attente</div><div style={{ color: "#94A3B8", fontSize: 12, marginTop: 4 }}>La liste est vérifiée automatiquement toutes les 5 minutes.</div></Card> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 390px), 1fr))", gap: 14 }}>
        {pending.map(item => <Card key={item.id} style={{ padding: 0, overflow: "hidden" }}>
          {item.mediaUrl && <img src={item.mediaUrl} alt="Aperçu de la publication" style={{ width: "100%", height: 190, objectFit: "cover", display: "block", background: "#F1F5F9" }} />}
          <div style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}><Badge text={item.club} color="#0F56B8" /><Badge text="En attente" color="#F59E0B" /></div>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, marginBottom: 9 }}>📅 {formatPublicationDate(item.publicationDate)}</div>
            <div style={{ fontSize: 12, color: "#2D2D30", lineHeight: 1.65, whiteSpace: "pre-wrap", maxHeight: 118, overflow: "hidden" }}>{item.text || "Publication sans texte"}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>{(item.networks || []).map(network => <span key={network} style={{ padding: "4px 8px", borderRadius: 7, background: "#F1F5F9", color: "#475569", fontSize: 10, fontWeight: 700 }}>{network}</span>)}</div>
            <a href={metricoolUrl} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center", marginTop: 15, padding: "9px 12px", borderRadius: 9, background: "#0F56B8", color: "#fff", textDecoration: "none", fontSize: 11, fontWeight: 800 }}>Examiner puis valider / refuser ↗</a>
          </div>
        </Card>)}
      </div>}
    <div style={{ marginTop: 14, color: "#94A3B8", fontSize: 10 }}>La décision est effectuée dans Metricool afin de conserver son historique d’approbation officiel. Toute nouvelle soumission déclenche une notification dans l’application et une notification push si elles sont activées.</div>
  </div>;
}

function ReportingPage({ clubs, reportingData, setReportingData, currentUserId, isAdmin, currentUser }) {
  const syncStatus = useFirestoreValue("ep:metricool-sync-status", null);
  const getLastMonthWithData = () => {
    const months = Object.keys(reportingData || {}).filter(k => (reportingData[k] || []).length > 0).sort();
    if (months.length > 0) return months[months.length - 1];
    // Default to PREVIOUS month (on saisit toujours le mois passé)
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  };
  const [selectedMonth, setSelectedMonth] = useState(getLastMonthWithData);
  const [editModal, setEditModal] = useState(false);
  const [editClubId, setEditClubId] = useState(null);
  const [editForm, setEditForm] = useState({ abonnes: 0, txEvol: 0, publications: 0, stories: 0, porteeMoy: 0, interactions: 0, engagement: 0 });
  const [detailClub, setDetailClub] = useState(null);
  const [chartMetric, setChartMetric] = useState("abonnes");

  // Generate last 12 months for selection
  const generateMonths = () => {
    const months = new Set(Object.keys(reportingData));
    // Start from December 2025
    const start = new Date(2025, 11, 1); // December 2025
    const now = new Date();
    const d = new Date(start);
    while (d <= now) {
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      d.setMonth(d.getMonth() + 1);
    }
    return [...months].sort();
  };
  const allMonths = generateMonths();
  const monthData = reportingData[selectedMonth] || [];
  const visibleClubs = isAdmin ? clubs : clubs.filter(c => (currentUser?.clubs || []).some(uc => String(uc) === String(c.id)));
  const effectiveClubs = visibleClubs;
  const MONTH_NAMES = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const formatMonth = (m) => { const [y, mo] = m.split("-"); return `${MONTH_NAMES[parseInt(mo) - 1] || mo} ${y}`; };

  // Scoring: normalize each metric across clubs for this month, then weight
  const calcScores = (data) => {
    if (data.length === 0) return [];
    const maxEng = Math.max(...data.map(d => d.engagement), 0.01);
    const maxTx = Math.max(...data.map(d => d.txEvol), 0.01);
    const maxPortee = Math.max(...data.map(d => d.porteeMoy), 0.01);
    const maxReg = Math.max(...data.map(d => d.publications + d.stories), 0.01);
    const maxEff = Math.max(...data.map(d => d.interactions > 0 && d.publications > 0 ? d.interactions / d.publications : 0), 0.01);

    return data.map(d => {
      const interPerPost = d.publications > 0 ? d.interactions / d.publications : 0;
      const sEng = (d.engagement / maxEng) * 100;
      const sTx = (d.txEvol / maxTx) * 100;
      const sPortee = (d.porteeMoy / maxPortee) * 100;
      const sReg = ((d.publications + d.stories) / maxReg) * 100;
      const sEff = (interPerPost / maxEff) * 100;
      const global = sEng * SCORE_WEIGHTS.engagement + sTx * SCORE_WEIGHTS.croissance + sPortee * SCORE_WEIGHTS.visibilite + sReg * SCORE_WEIGHTS.regularite + sEff * SCORE_WEIGHTS.efficacite;
      return { ...d, sEng, sTx, sPortee, sReg, sEff, global, interPerPost };
    }).sort((a, b) => b.global - a.global).map((d, i) => ({ ...d, rang: i + 1, niveau: d.global >= 75 ? "Très performant" : d.global >= 50 ? "Correct" : d.global >= 25 ? "À améliorer" : "Faible" }));
  };

  const scored = calcScores(monthData);
  const niveauColors = { "Très performant": "#10B981", "Correct": "#F59E0B", "À améliorer": "#F97316", "Faible": "#EF4444" };

  const openEdit = (clubId) => {
    const existing = monthData.find(d => d.clubId === clubId);
    setEditClubId(clubId);
    setEditForm(existing ? { abonnes: existing.abonnes, txEvol: existing.txEvol, publications: existing.publications, stories: existing.stories, porteeMoy: existing.porteeMoy, interactions: existing.interactions, engagement: existing.engagement } : { abonnes: 0, txEvol: 0, publications: 0, stories: 0, porteeMoy: 0, interactions: 0, engagement: 0 });
    setEditModal(true);
  };
  const saveEdit = () => {
    setReportingData(prev => {
      const md = prev[selectedMonth] || [];
      const exists = md.find(d => d.clubId === editClubId);
      const newEntry = { clubId: editClubId, ...editForm };
      const newMd = exists ? md.map(d => d.clubId === editClubId ? newEntry : d) : [...md, newEntry];
      return { ...prev, [selectedMonth]: newMd };
    });
    setEditModal(false);
  };
  const addMonth = () => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (!reportingData[key]) setReportingData(p => ({ ...p, [key]: [] }));
    setSelectedMonth(key);
  };

  // ===== PDF REPORT GENERATION =====
  const downloadPDF = (clubId) => {
    const isGlobal = !clubId;
    const title = isGlobal ? "Rapport Global — Tous les clubs" : `Rapport — ${clubs.find(c => String(c.id) === String(clubId))?.name || ""}`;
    const targetClubs = isGlobal ? clubs : clubs.filter(c => String(c.id) === String(clubId));
    const nLbl = (n) => n === "Très performant" ? "🟢" : n === "Correct" ? "🟡" : n === "À améliorer" ? "🟠" : "🔴";

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#2D2D30;font-size:11px;padding:0;margin:0}
.page{padding:20mm 15mm;max-width:210mm;margin:0 auto}
h1{font-size:20px;color:#fff;margin:0}
.header{background:#1E3A5F;color:#fff;padding:18px 24px;margin-bottom:20px;border-radius:0}
.header .sub{font-size:9px;opacity:0.7;margin-top:4px}
h2{font-size:15px;color:#1E3A5F;margin:24px 0 10px;padding-bottom:5px;border-bottom:2px solid #1E3A5F}
h3{font-size:12px;color:#334155;margin:14px 0 6px}
table{width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:10px}
th{background:#1E3A5F;color:#fff;padding:6px 8px;text-align:left;font-weight:600;font-size:9px}
td{padding:5px 8px;border-bottom:1px solid #E2E8F0}
tr:nth-child(even) td{background:#F4F2EF}
.stats{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 16px}
.stat{flex:1;min-width:90px;background:#F4F2EF;border:1px solid #E2E8F0;border-radius:6px;padding:8px;text-align:center}
.stat .val{font-size:16px;font-weight:800;color:#2D2D30}
.stat .lbl{font-size:8px;color:#6B7280;text-transform:uppercase;margin-top:2px}
.bar-row{display:flex;align-items:center;gap:6px;margin:3px 0}
.bar-label{width:120px;font-size:9px;color:#6B7280;flex-shrink:0}
.bar-bg{flex:1;height:10px;background:#F1F5F9;border-radius:5px;overflow:hidden}
.bar-fill{height:100%;border-radius:5px}
.bar-val{width:35px;text-align:right;font-size:9px;font-weight:700}
.footer{margin-top:30px;padding-top:10px;border-top:1px solid #E2E8F0;color:#94A3B8;font-size:8px;text-align:center}
@media print{
  body{padding:0;margin:0}
  .page{padding:10mm}
  .no-print{display:none!important}
  h2{break-before:auto}
}
</style></head><body>
<div class="page">
<div class="header">
  <h1>${title}</h1>
  <div class="sub">Généré le ${new Date().toLocaleDateString("fr-FR")} — Mois sélectionné : ${formatMonth(selectedMonth)}</div>
</div>`;

    // Global classement
    if (isGlobal && scored.length > 0) {
      html += `<h2>Classement interne — ${formatMonth(selectedMonth)}</h2>`;
      html += `<table><tr><th>Rang</th><th>Club</th><th>Score Global</th><th>Niveau</th></tr>`;
      scored.forEach(s => {
        const c = clubs.find(x => String(x.id) === String(s.clubId));
        html += `<tr><td><strong>${s.rang}</strong></td><td style="font-weight:600;color:${c?.color||"#2D2D30"}">${c?.name || ""}</td><td><strong>${s.global.toFixed(2)}</strong></td><td>${nLbl(s.niveau)} ${s.niveau}</td></tr>`;
      });
      html += `</table>`;
    }

    // Per club
    targetClubs.forEach(club => {
      const cs = scored.find(s => s.clubId === club.id);
      html += `<h2 style="color:${club.color}">${club.name}</h2>`;

      if (cs) {
        html += `<div class="stats">`;
        [
          { l: "Abonnés", v: cs.abonnes.toLocaleString() },
          { l: "Tx évolution", v: cs.txEvol + "%" },
          { l: "Publications", v: cs.publications },
          { l: "Stories", v: cs.stories },
          { l: "Portée moy/post", v: cs.porteeMoy.toFixed(0) },
          { l: "Interactions", v: cs.interactions },
          { l: "Engagement", v: cs.engagement.toFixed(2) + "%" },
          { l: "Score Global", v: cs.global.toFixed(2) },
        ].forEach(s => { html += `<div class="stat"><div class="val">${s.v}</div><div class="lbl">${s.l}</div></div>`; });
        html += `</div>`;

        html += `<h3>Scores pondérés</h3>`;
        html += `<table><tr><th>Critère</th><th>Poids</th><th>Score / 100</th></tr>`;
        [
          { l: "Engagement", w: "0,30", s: cs.sEng },
          { l: "Croissance abonnés", w: "0,25", s: cs.sTx },
          { l: "Visibilité (portée)", w: "0,20", s: cs.sPortee },
          { l: "Régularité (posts+stories)", w: "0,15", s: cs.sReg },
          { l: "Efficacité (inter./post)", w: "0,10", s: cs.sEff },
        ].forEach(r => { html += `<tr><td>${r.l}</td><td>${r.w}</td><td><strong>${r.s.toFixed(2)}</strong></td></tr>`; });
        html += `</table>`;

        // Visual bars
        const bars = [
          { l: "Engagement ×0.30", s: cs.sEng, c: "#0F56B8" },
          { l: "Croissance ×0.25", s: cs.sTx, c: "#10B981" },
          { l: "Visibilité ×0.20", s: cs.sPortee, c: "#F59E0B" },
          { l: "Régularité ×0.15", s: cs.sReg, c: "#FEB601" },
          { l: "Efficacité ×0.10", s: cs.sEff, c: "#EC4899" },
        ];
        bars.forEach(b => {
          html += `<div class="bar-row"><span class="bar-label">${b.l}</span><div class="bar-bg"><div class="bar-fill" style="width:${Math.min(b.s, 100)}%;background:${b.c}"></div></div><span class="bar-val" style="color:${b.c}">${b.s.toFixed(0)}</span></div>`;
        });
      } else {
        html += `<p style="color:#94A3B8;margin:10px 0">Aucune donnée pour ce mois.</p>`;
      }

      // Evolution
      if (allMonths.length > 1) {
        html += `<h3>Évolution mensuelle</h3>`;
        html += `<table><tr><th>Mois</th><th>Abonnés</th><th>Tx évol</th><th>Publi.</th><th>Stories</th><th>Portée</th><th>Interact.</th><th>Engage.</th></tr>`;
        allMonths.forEach(m => {
          const d = (reportingData[m] || []).find(x => x.clubId === club.id);
          html += `<tr><td>${formatMonth(m)}</td><td>${d ? d.abonnes.toLocaleString() : "—"}</td><td>${d ? d.txEvol.toFixed(1) + "%" : "—"}</td><td>${d ? d.publications : "—"}</td><td>${d ? d.stories : "—"}</td><td>${d ? d.porteeMoy.toFixed(0) : "—"}</td><td>${d ? d.interactions : "—"}</td><td>${d ? d.engagement.toFixed(2) : "—"}</td></tr>`;
        });
        html += `</table>`;
      }
    });

    html += `<div class="footer">Rapport généré par Esprit Padel Communication — ${new Date().toLocaleDateString("fr-FR")}</div>`;
    html += `</div>`;
    html += `</body></html>`;

    downloadAsPdf(html);
  };

  const downloadCSV = () => {
    const headers = ["Mois","Club","Abonnés","Tx évol (%)","Publications","Reels","Stories","Portée moy/post","Portée moy/reel","Portée moy/story","Interactions","Engagement (%)","Vues","J'aime","Commentaires","Partages","Enregistrements","Impressions stories"];
    const rows = [headers.join(";")];
    allMonths.forEach(m => {
      clubs.forEach(c => {
        const d = (reportingData[m] || []).find(x => x.clubId === c.id);
        rows.push([m, c.name, d?.abonnes || "", d?.txEvol || "", d?.publications || "", d?.reels || "", d?.stories || "", d?.porteeMoy || "", d?.porteeMoyReel || "", d?.porteeMoyStory || "", d?.interactions || "", d?.engagement || "", d?.vues || "", d?.jaimes || "", d?.commentaires || "", d?.partages || "", d?.enregistrements || "", d?.storiesImpressions || ""].join(";"));
      });
    });
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Reporting_${selectedMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Evolution data for charts
  const getClubHistory = (clubId, field) => allMonths.map(m => { const d = (reportingData[m] || []).find(x => x.clubId === clubId); return d ? d[field] : 0; });

  // Bar chart component
  const BarChart = ({ data, labels, color, height = 120, label }) => {
    const max = Math.max(...data, 1);
    return (
      <div>
        {label && <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>{label}</div>}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height }}>
          {data.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 9, color: "#6B7280", fontWeight: 600 }}>{typeof v === "number" ? (v >= 1000 ? (v/1000).toFixed(1)+"k" : Number.isInteger(v) ? v : v.toFixed(1)) : v}</span>
              <div style={{ width: "100%", maxWidth: 32, height: `${Math.max((v / max) * (height - 24), 2)}px`, background: color + "60", borderRadius: 4, transition: "height .3s" }} />
              <span style={{ fontSize: 8, color: "#94A3B8" }}>{labels[i]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Detail view for a specific club
  if (detailClub) {
    const club = clubs.find(c => String(c.id) === String(detailClub));
    const clubScored = scored.find(s => s.clubId === detailClub);
    const monthLabels = allMonths.map(m => m.split("-")[1]);
    if (!club) { setDetailClub(null); return null; }
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={() => setDetailClub(null)} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#6B7280", fontFamily: "inherit" }}>← Retour</button>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: club.color }} />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, flex: 1 }}>{club.name} — Détail</h2>
          {clubScored && <Badge text={`Rang ${clubScored.rang} · ${clubScored.niveau}`} color={niveauColors[clubScored.niveau]} />}
          <Btn onClick={() => downloadPDF(club.id)} small color="#1E3A5F">⬇ Télécharger le rapport PDF</Btn>
        </div>

        <MetricoolReportingDetails month={selectedMonth} clubId={detailClub} clubColor={club.color} scored={clubScored} monthLabel={formatMonth(selectedMonth)} />

        {/* Scores breakdown */}
        {clubScored && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30", marginBottom: 12 }}>Scores pondérés</div>
            {[
              { label: "Engagement", score: clubScored.sEng, weight: "×0.30", color: "#0F56B8" },
              { label: "Croissance abonnés", score: clubScored.sTx, weight: "×0.25", color: "#10B981" },
              { label: "Visibilité (portée)", score: clubScored.sPortee, weight: "×0.20", color: "#F59E0B" },
              { label: "Régularité (posts+stories)", score: clubScored.sReg, weight: "×0.15", color: "#FEB601" },
              { label: "Efficacité (inter./post)", score: clubScored.sEff, weight: "×0.10", color: "#EC4899" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "#6B7280", width: 180, flexShrink: 0 }}>{s.label} <span style={{ color: "#94A3B8" }}>{s.weight}</span></span>
                <div style={{ flex: 1 }}><ProgressBar value={s.score} max={100} height={8} color={s.color} /></div>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color, width: 50, textAlign: "right" }}>{s.score.toFixed(1)}</span>
              </div>
            ))}
          </Card>
        )}

        {/* Evolution charts */}
        {allMonths.length > 1 && (
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30", marginBottom: 14 }}>Évolution mensuelle</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              <BarChart data={getClubHistory(detailClub, "abonnes")} labels={monthLabels} color={club.color} label="Abonnés" />
              <BarChart data={getClubHistory(detailClub, "engagement")} labels={monthLabels} color="#0F56B8" label="Engagement %" />
              <BarChart data={getClubHistory(detailClub, "interactions")} labels={monthLabels} color="#10B981" label="Interactions" />
              <BarChart data={getClubHistory(detailClub, "publications")} labels={monthLabels} color="#F59E0B" label="Publications" />
              <BarChart data={getClubHistory(detailClub, "stories")} labels={monthLabels} color="#FEB601" label="Stories" />
              <BarChart data={getClubHistory(detailClub, "porteeMoy")} labels={monthLabels} color="#EC4899" label="Portée moy/post" />
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ===== MAIN VIEW =====
  // Multi-line evolution chart data
  const chartMetrics = [
    { key: "abonnes", label: "Abonnés", format: v => v >= 1000 ? (v/1000).toFixed(1)+"k" : v },
    { key: "engagement", label: "Engagement %", format: v => v.toFixed(1) },
    { key: "interactions", label: "Interactions", format: v => v >= 1000 ? (v/1000).toFixed(1)+"k" : v },
  ];
  const activeMetric = chartMetrics.find(m => m.key === chartMetric) || chartMetrics[0];
  const selectedMonthIndex = allMonths.indexOf(selectedMonth);
  const previousMonth = selectedMonthIndex > 0 ? allMonths[selectedMonthIndex - 1] : null;
  const nextMonth = selectedMonthIndex >= 0 && selectedMonthIndex < allMonths.length - 1 ? allMonths[selectedMonthIndex + 1] : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Reporting</h2>{syncStatus && <div style={{ marginTop: 4, fontSize: 10, color: syncStatus.ok ? "#059669" : "#DC2626" }}>{syncStatus.ok ? `● Metricool synchronisé le ${new Date(syncStatus.syncedAt).toLocaleString("fr-FR")}` : "● Dernière synchronisation Metricool en erreur"}</div>}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn onClick={downloadCSV} small outline color="#059669">⬇ CSV</Btn>
          <Btn onClick={() => downloadPDF(null)} small color="#1E3A5F">⬇ Rapport global PDF</Btn>
        </div>
      </div>

      {/* Sélecteur de période compact */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20, padding: 10, background: "#fff", border: "1px solid #E7EAF0", borderRadius: 12 }}>
        <button disabled={!previousMonth} onClick={() => previousMonth && setSelectedMonth(previousMonth)} aria-label="Mois précédent" style={{ width: 36, height: 36, borderRadius: 9, border: "none", background: previousMonth ? "#F1F5F9" : "#F8FAFC", color: previousMonth ? "#1E3A5F" : "#CBD5E1", cursor: previousMonth ? "pointer" : "default", fontSize: 20, fontWeight: 800 }}>‹</button>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>Période</span><select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ minWidth: 180, padding: "9px 34px 9px 12px", border: "1px solid #CBD5E1", borderRadius: 9, background: "#fff", color: "#1E3A5F", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>{[...allMonths].reverse().map(month => <option key={month} value={month}>{formatMonth(month)}</option>)}</select></div>
        <button disabled={!nextMonth} onClick={() => nextMonth && setSelectedMonth(nextMonth)} aria-label="Mois suivant" style={{ width: 36, height: 36, borderRadius: 9, border: "none", background: nextMonth ? "#F1F5F9" : "#F8FAFC", color: nextMonth ? "#1E3A5F" : "#CBD5E1", cursor: nextMonth ? "pointer" : "default", fontSize: 20, fontWeight: 800 }}>›</button>
      </div>

      {/* ====== EVOLUTION CHART — All clubs ====== */}
      {allMonths.length >= 1 && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#2D2D30" }}>Évolution — {activeMetric.label}</div>
            <div style={{ display: "flex", gap: 4 }}>
              {chartMetrics.map(m => (
                <button key={m.key} onClick={() => setChartMetric(m.key)} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: chartMetric === m.key ? "#1E3A5F" : "#F1F5F9", color: chartMetric === m.key ? "#fff" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{m.label}</button>
              ))}
            </div>
          </div>
          {(() => {
            // Build SVG multi-line chart
            const W = 700, H = 220, PAD_L = 50, PAD_R = 20, PAD_T = 10, PAD_B = 30;
            const chartW = W - PAD_L - PAD_R, chartH = H - PAD_T - PAD_B;
            const pts = allMonths.length;
            // Gather all values
            const allVals = [];
            clubs.forEach(c => { allMonths.forEach(m => { const d = (reportingData[m] || []).find(x => x.clubId === c.id); allVals.push(d ? d[chartMetric] : 0); }); });
            const maxVal = Math.max(...allVals, 1);
            const minVal = Math.min(...allVals.filter(v => v > 0), 0);
            const range = maxVal - minVal || 1;

            const xStep = pts > 1 ? chartW / (pts - 1) : chartW;
            const getY = (v) => PAD_T + chartH - ((v - minVal) / range) * chartH;
            const getX = (i) => PAD_L + (pts > 1 ? i * xStep : chartW / 2);

            return (
              <div>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
                  {/* Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map(p => {
                    const y = PAD_T + chartH - p * chartH;
                    const val = minVal + p * range;
                    return (
                      <g key={p}>
                        <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                        <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94A3B8" fontFamily="JetBrains Mono, monospace">{activeMetric.format(val)}</text>
                      </g>
                    );
                  })}
                  {/* Month labels */}
                  {allMonths.map((m, i) => (
                    <text key={m} x={getX(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#6B7280" fontFamily="Montserrat, sans-serif" fontWeight="600">{m.split("-")[1]}/{m.split("-")[0].slice(2)}</text>
                  ))}
                  {/* Selected month vertical line */}
                  {(() => { const si = allMonths.indexOf(selectedMonth); return si >= 0 ? <line x1={getX(si)} y1={PAD_T} x2={getX(si)} y2={PAD_T + chartH} stroke="#1E3A5F" strokeWidth="1" strokeDasharray="4,3" opacity="0.4" /> : null; })()}
                  {/* Lines per club */}
                  {clubs.map(c => {
                    const values = allMonths.map(m => { const d = (reportingData[m] || []).find(x => x.clubId === c.id); return d ? d[chartMetric] : 0; });
                    const hasData = values.some(v => v > 0);
                    if (!hasData) return null;
                    const pathD = values.map((v, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(v)}`).join(" ");
                    return (
                      <g key={c.id}>
                        <path d={pathD} fill="none" stroke={c.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        {values.map((v, i) => v > 0 ? <circle key={i} cx={getX(i)} cy={getY(v)} r="4" fill={c.color} stroke="#fff" strokeWidth="2" /> : null)}
                      </g>
                    );
                  })}
                </svg>
                {/* Legend */}
                <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
                  {clubs.map(c => {
                    const lastVal = (() => { for (let i = allMonths.length - 1; i >= 0; i--) { const d = (reportingData[allMonths[i]] || []).find(x => x.clubId === c.id); if (d) return d[chartMetric]; } return null; })();
                    return (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.color }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>{c.name}</span>
                        {lastVal !== null && <span style={{ fontSize: 10, color: "#94A3B8" }}>({activeMetric.format(lastVal)})</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </Card>
      )}

      {/* Classement / Dashboard */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#2D2D30", marginBottom: 14 }}>Classement interne — {formatMonth(selectedMonth)}</div>
        {scored.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#94A3B8", fontSize: 13 }}>Aucune donnée pour ce mois. Ajoutez les données de chaque club.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#1E3A5F", color: "#fff" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", borderRadius: "8px 0 0 0", fontWeight: 600 }}>Club</th>
                  <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>Score Global</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 600 }}>Rang</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", borderRadius: "0 8px 0 0", fontWeight: 600 }}>Niveau</th>
                </tr>
              </thead>
              <tbody>
                {scored.map(s => {
                  const club = clubs.find(c => String(c.id) === String(s.clubId));
                  return (
                    <tr key={s.clubId} onClick={() => setDetailClub(s.clubId)} style={{ borderBottom: "1px solid #F1F5F9", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = "#F4F2EF"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: club?.color || "#2D2D30" }}>{club?.name}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>{s.global.toFixed(2)}</td>
                      <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700 }}>{s.rang}</td>
                      <td style={{ padding: "10px 12px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: "50%", background: niveauColors[s.niveau], display: "inline-block" }} />{s.niveau}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Data table per club */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#2D2D30" }}>Données — {formatMonth(selectedMonth)}</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#1E3A5F", color: "#fff" }}>
                {["Club","Abonnés","Tx évol","Publications","Reels","Stories","Portée moy/post","Interactions","Engagement","Vues","Actions"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: h === "Club" || h === "Actions" ? "left" : "right", fontWeight: 600, whiteSpace: "nowrap", fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clubs.map(c => {
                const d = monthData.find(x => x.clubId === c.id);
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: c.color }}>{c.name}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{d ? d.abonnes.toLocaleString() : "—"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{d ? d.txEvol.toFixed(1) + "%" : "—"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{d ? d.publications : "—"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{d?.reels ?? "—"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{d ? d.stories : "—"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{d ? d.porteeMoy.toFixed(0) : "—"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{d ? d.interactions : "—"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{d ? d.engagement.toFixed(2) : "—"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{d?.vues?.toLocaleString?.() ?? "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {isAdmin && <button onClick={() => openEdit(c.id)} style={{ background: "#0F56B810", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#0F56B8", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{d ? "✏️ Modifier" : "➕ Ajouter"}</button>}
                        <button onClick={() => setDetailClub(c.id)} style={{ background: "#F1F5F9", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#6B7280", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📊 Détail</button>
                        <button onClick={() => downloadPDF(c.id)} style={{ background: "#1E3A5F10", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#1E3A5F", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>⬇ PDF</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pondérations */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30", marginBottom: 10 }}>Pondérations du score</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[{ label: "Engagement", w: "0,30", color: "#0F56B8" }, { label: "Croissance abonnés", w: "0,25", color: "#10B981" }, { label: "Visibilité (portée)", w: "0,20", color: "#F59E0B" }, { label: "Régularité (posts+stories)", w: "0,15", color: "#FEB601" }, { label: "Efficacité (inter./post)", w: "0,10", color: "#EC4899" }].map(p => (
            <div key={p.label} style={{ padding: "8px 14px", background: p.color + "10", borderRadius: 8, border: `1px solid ${p.color}20` }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: p.color }}>{p.label}</span>
              <span style={{ fontSize: 12, color: "#6B7280", marginLeft: 8 }}>{p.w}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Edit modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={`Données — ${clubs.find(c => String(c.id) === String(editClubId))?.name || ""} — ${formatMonth(selectedMonth)}`}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Input label="Abonnés" value={editForm.abonnes} onChange={v => setEditForm(p => ({ ...p, abonnes: Number(v) }))} type="number" />
          <Input label="Tx évolution abonnés (%)" value={editForm.txEvol} onChange={v => setEditForm(p => ({ ...p, txEvol: Number(v) }))} type="number" />
          <Input label="Publications" value={editForm.publications} onChange={v => setEditForm(p => ({ ...p, publications: Number(v) }))} type="number" />
          <Input label="Stories" value={editForm.stories} onChange={v => setEditForm(p => ({ ...p, stories: Number(v) }))} type="number" />
          <Input label="Portée moy / post" value={editForm.porteeMoy} onChange={v => setEditForm(p => ({ ...p, porteeMoy: Number(v) }))} type="number" />
          <Input label="Interactions" value={editForm.interactions} onChange={v => setEditForm(p => ({ ...p, interactions: Number(v) }))} type="number" />
        </div>
        <Input label="Engagement (%)" value={editForm.engagement} onChange={v => setEditForm(p => ({ ...p, engagement: Number(v) }))} type="number" />
        <Btn onClick={saveEdit}>Enregistrer</Btn>
      </Modal>
    </div>
  );
}

// ==================== EDITORIAL (CALENDAR VIEW + CRUD) ====================
function EditorialPage({ clubs, publications, setPublications }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ platform: "Instagram", type: "Post", title: "", status: "Brouillon", date: "", notes: "" });
  const [viewMonth, setViewMonth] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });
  const [editorialTab, setEditorialTab] = useState("calendar");

  // Only show MY publications — no club dimension
  const filtered = publications.filter(p => String(p.owner) === String(CURRENT_USER_ID));
  const statusColors = { "Publié": "#10B981", "Planifié": "#0F56B8", "Brouillon": "#F59E0B" };
  const typeIcons = { Post: "📷", Reel: "🎬", Story: "📱", Carrousel: "🖼️", Newsletter: "✉️" };
  const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

  const openNew = (date = "") => { setEditing(null); setForm({ platform: "Instagram", type: "Post", title: "", status: "Brouillon", date, notes: "" }); setModalOpen(true); };
  const openEdit = (p) => { setEditing(p.id); setForm({ platform: p.platform, type: p.type, title: p.title, status: p.status, date: p.date, notes: p.notes || "" }); setModalOpen(true); };
  const save = () => {
    if (!form.title) return;
    if (editing) setPublications(p => p.map(x => String(x.id) === String(editing) ? { ...x, ...form } : x));
    else setPublications(p => [...p, { id: uid(), ...form, owner: CURRENT_USER_ID }]);
    setModalOpen(false);
  };
  const del = (id) => {
    const pub = publications.find(p => String(p.id) === String(id));
    if (pub && String(pub.owner) !== String(CURRENT_USER_ID)) return;
    setPublications(p => p.filter(x => String(x.id) !== String(id)));
  };

  // Calendar
  const { year, month } = viewMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => setViewMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setViewMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });

  // Stats
  const totalPubs = filtered.length;
  const byStatus = { Brouillon: filtered.filter(p => p.status === "Brouillon").length, Planifié: filtered.filter(p => p.status === "Planifié").length, Publié: filtered.filter(p => p.status === "Publié").length };

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <button onClick={() => setEditorialTab("calendar")} style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: editorialTab === "calendar" ? "#0F56B8" : "#F1F5F9", color: editorialTab === "calendar" ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📅 Calendrier éditorial</button>
        <button onClick={() => setEditorialTab("metricool")} style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: editorialTab === "metricool" ? "#0F56B8" : "#F1F5F9", color: editorialTab === "metricool" ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📊 Metricool</button>
      </div>

      {/* Metricool Tab */}
      {editorialTab === "metricool" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>📊 Metricool</h2>
              <div style={{ fontSize: 12, color: "#6B7280" }}>Préparez vos brouillons ici puis copiez-les dans Metricool</div>
            </div>
            <a href="https://app.metricool.com/planner" target="_blank" rel="noreferrer" style={{ padding: "10px 18px", borderRadius: 10, background: "#0F56B8", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>↗ Ouvrir Metricool Planner</a>
          </div>

          <Card style={{ padding: 20, marginBottom: 16, background: "linear-gradient(135deg, #0F56B815, #FEB60115)", border: "1.5px solid #0F56B830" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "start" }}>
              <div style={{ fontSize: 32 }}>💡</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30", marginBottom: 6 }}>Pourquoi Metricool ne s'affiche pas ici ?</div>
                <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>Pour des raisons de sécurité, Metricool bloque l'affichage dans une fenêtre intégrée. Utilisez le bouton ci-dessus pour ouvrir Metricool dans un nouvel onglet, ou préparez vos brouillons ci-dessous puis copiez-les ensuite dans Metricool.</div>
              </div>
            </div>
          </Card>

          {/* Local drafts to prepare for Metricool */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📝 Mes brouillons</h3>
            <Btn onClick={() => openNew()} small>+ Nouveau brouillon</Btn>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {filtered.filter(p => p.status === "Brouillon").length === 0 ? (
              <Card style={{ padding: 30, textAlign: "center", gridColumn: "1/-1" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>Aucun brouillon pour le moment</div>
                <Btn onClick={() => openNew()} small>Créer mon premier brouillon</Btn>
              </Card>
            ) : filtered.filter(p => p.status === "Brouillon").map(p => (
              <Card key={p.id} style={{ padding: 14, borderLeft: `4px solid #F59E0B` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30" }}>{typeIcons[p.type] || "📷"} {p.title}</div>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{p.platform} · {p.type}{p.date && ` · ${p.date}`}</div>
                  </div>
                  <span style={{ padding: "2px 8px", borderRadius: 10, background: "#F59E0B15", color: "#F59E0B", fontSize: 10, fontWeight: 700 }}>BROUILLON</span>
                </div>
                {p.notes && <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.5, marginBottom: 8, padding: 8, background: "#F4F2EF", borderRadius: 6, maxHeight: 80, overflow: "auto" }}>{p.notes}</div>}
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => { navigator.clipboard.writeText(`${p.title}\n\n${p.notes || ""}`); alert("Copié !"); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#10B98115", color: "#10B981", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📋 Copier</button>
                  <button onClick={() => openEdit(p)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#0F56B815", color: "#0F56B8", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✏️ Modifier</button>
                  <button onClick={() => del(p.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#FEE2E2", color: "#EF4444", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                </div>
              </Card>
            ))}
          </div>

          {/* Modal for new/edit draft */}
          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier le brouillon" : "Nouveau brouillon"}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Select label="Plateforme" value={form.platform} onChange={v => setForm(p => ({ ...p, platform: v }))} options={["Instagram","Facebook","TikTok","LinkedIn","X","YouTube"].map(x => ({ value: x, label: x }))} />
              <Select label="Type" value={form.type} onChange={v => setForm(p => ({ ...p, type: v }))} options={["Post","Reel","Story","Carrousel","Newsletter"].map(x => ({ value: x, label: x }))} />
            </div>
            <Input label="Titre" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} />
            <Textarea label="Caption / Notes" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} rows={6} />
            <Input label="Date prévue" value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} type="date" />
            <Btn onClick={() => { setForm(p => ({ ...p, status: "Brouillon" })); save(); }}>{editing ? "Enregistrer" : "Créer le brouillon"}</Btn>
          </Modal>
        </div>
      )}

      {/* Calendar Tab */}
      {editorialTab === "calendar" && (<div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Mon calendrier éditorial</h2>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => {
            const monthPubs = filtered.filter(p => { const d = new Date(p.date); return d.getFullYear() === year && d.getMonth() === month; }).sort((a, b) => a.date.localeCompare(b.date));
            const html = `<html><head><style>body{font-family:Montserrat,sans-serif;padding:30px}h1{color:#2D2D30;font-size:22px}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#0F56B8;color:#fff;padding:10px;text-align:left;font-size:12px}td{padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:12px}.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}</style></head><body><h1>Calendrier éditorial — ${monthNames[month]} ${year}</h1><p style="color:#6B7280;font-size:13px">Esprit Padel Communication</p><table><tr><th>Date</th><th>Plateforme</th><th>Type</th><th>Titre</th><th>Statut</th></tr>${monthPubs.map(p => `<tr><td>${p.date}</td><td>${p.platform}</td><td>${p.type}</td><td>${p.title}</td><td><span class="badge" style="background:${statusColors[p.status] || "#94A3B8"}20;color:${statusColors[p.status] || "#94A3B8"}">${p.status}</span></td></tr>`).join("")}</table></body></html>`;
            downloadAsPdf(html, `calendrier_editorial_${monthNames[month]}_${year}.pdf`);
          }} style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📄 PDF</button>
          <button onClick={() => {
            const monthPubs = filtered.filter(p => { const d = new Date(p.date); return d.getFullYear() === year && d.getMonth() === month; }).sort((a, b) => a.date.localeCompare(b.date));
            const body = `Calendrier éditorial — ${monthNames[month]} ${year}\n\n${monthPubs.map(p => `${p.date} | ${p.platform} | ${p.type} | ${p.title} (${p.status})`).join("\n")}\n\n— Esprit Padel Communication`;
            window.open(`mailto:?subject=${encodeURIComponent(`Calendrier éditorial ${monthNames[month]} ${year}`)}&body=${encodeURIComponent(body)}`);
          }} style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📧 Email</button>
          <Btn onClick={() => openNew()}>+ Nouvelle publication</Btn>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
        <span>🔒</span> Espace personnel — seules vos publications apparaissent ici
      </div>

      {/* Quick stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Total", value: totalPubs, color: "#475569" },
          { label: "Brouillons", value: byStatus.Brouillon, color: "#F59E0B" },
          { label: "Planifiées", value: byStatus.Planifié, color: "#0F56B8" },
          { label: "Publiées", value: byStatus.Publié, color: "#10B981" },
        ].map(s => (
          <div key={s.label} style={{ background: s.color + "08", border: `1px solid ${s.color}15`, borderRadius: 10, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 11, color: "#6B7280" }}>{s.label}</span>
          </div>
        ))}
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6B7280" }}>←</button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{monthNames[month]} {year}</span>
          <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6B7280" }}>→</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
          {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#94A3B8", padding: 4 }}>{d}</div>)}
          {cells.map((d, i) => {
            const dateStr = d ? `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
            const dayPubs = dateStr ? filtered.filter(p => p.date === dateStr) : [];
            const isToday = d && dateStr === new Date().toISOString().split("T")[0];
            return (
              <div key={i} onClick={() => d && openNew(dateStr)} style={{ minHeight: 74, maxHeight: 100, padding: 4, borderRadius: 8, background: isToday ? "#EFF6FF" : d ? "#FAFBFC" : "transparent", border: isToday ? "1.5px solid #0F56B8" : "1px solid #F1F5F9", cursor: d ? "pointer" : "default", overflow: "hidden" }}>
                {d && <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? "#0F56B8" : "#475569", marginBottom: 2 }}>{d}</div>}
                {dayPubs.slice(0, 3).map(p => (
                  <div key={p.id} onClick={e => { e.stopPropagation(); openEdit(p); }} style={{ fontSize: 9, padding: "2px 4px", borderRadius: 4, marginBottom: 1, background: statusColors[p.status] + "15", color: statusColors[p.status], fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", display: "block", maxWidth: "100%" }}>
                    {typeIcons[p.type]} {(p.title || "").slice(0, 15)}
                  </div>
                ))}
                {dayPubs.length > 3 && <div style={{ fontSize: 8, color: "#94A3B8" }}>+{dayPubs.length - 3}</div>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* List view below calendar */}
      <SectionHeader title="Toutes mes publications" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.sort((a, b) => a.date.localeCompare(b.date)).map(p => (
          <Card key={p.id} style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                <span style={{ fontSize: 20 }}>{typeIcons[p.type] || "📄"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#2D2D30" }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                    {p.date} · {p.platform} · {p.type}
                    {p.notes && <span style={{ marginLeft: 6 }}>📝</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Badge text={p.status} color={statusColors[p.status]} />
                <button onClick={() => openEdit(p)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>✏️</button>
                <button onClick={() => del(p.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#EF4444" }}>🗑️</button>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "#94A3B8", fontSize: 13 }}>Aucune publication</div>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier la publication" : "Nouvelle publication"}>
        <Input label="Titre" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} />
        <Input label="Date" value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} type="date" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Select label="Plateforme" value={form.platform} onChange={v => setForm(p => ({ ...p, platform: v }))} options={["Instagram","Facebook","TikTok","LinkedIn"]} />
          <Select label="Type" value={form.type} onChange={v => setForm(p => ({ ...p, type: v }))} options={["Post","Reel","Story","Carrousel","Newsletter"]} />
        </div>
        <Select label="Statut" value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))} options={["Brouillon","Planifié","Publié"]} />
        <Textarea label="Notes personnelles" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} rows={3} />
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={save}>Enregistrer</Btn>
          {editing && <Btn onClick={() => { del(editing); setModalOpen(false); }} color="#EF4444" outline>Supprimer</Btn>}
        </div>
      </Modal>
    </div>)}
    </div>
  );
}

// ==================== DOCUMENTS (CRUD + VISIBILITY + OWNERSHIP) ====================
// ==================== DRIVE (Google Drive intégré) ====================
const GDRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1lHhG-yFmx43lDNEv9Jy8nh0UcR5ATIjf";
const DRIVE_SPACES = [
  { id: "1lHhG-yFmx43lDNEv9Jy8nh0UcR5ATIjf", name: "Tous les clubs", icon: "🏠", color: "#1E3A5F" },
  { id: "1-_-P_QqiTHxvZKZRhufOsT0iPaYaxp5H", name: "France", icon: "🇫🇷", color: "#0F56B8" },
  { id: "1HCFhXZE6zHxkEWHOIOy485JDJusb8_v_", name: "La Boisse", icon: "📍", color: "#10B981" },
  { id: "1MPEiZ_ZuPQW1Yg0nJi5sZ9TJg6k-f6KT", name: "Lyon", icon: "📍", color: "#F59E0B" },
  { id: "1ShKM7Oh3q8OY8gNvaX6tmFMJmDWlbbfu", name: "Mâcon", icon: "📍", color: "#EC4899" },
];

function DrivePage({ isMobile, clubs = [], isAdmin = false }) {
  const allowedClubNames = new Set((clubs || []).map(club => String(club.name || "").trim().toLowerCase()));
  const visibleSpaces = isAdmin
    ? DRIVE_SPACES
    : DRIVE_SPACES.filter(space => space.name !== "Tous les clubs" && allowedClubNames.has(space.name.toLowerCase()));
  const defaultSpace = visibleSpaces[0] || DRIVE_SPACES[0];
  const [view, setView] = useState("grid");
  const [spaceId, setSpaceId] = useState(defaultSpace.id);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const activeSpace = visibleSpaces.find(space => space.id === spaceId) || defaultSpace;

  useEffect(() => {
    if (!visibleSpaces.some(space => space.id === spaceId)) setSpaceId(defaultSpace.id);
  }, [spaceId, defaultSpace.id, visibleSpaces]);

  const embedUrl = `https://drive.google.com/embeddedfolderview?id=${spaceId}#${view}`;
  const changeSpace = id => { setSpaceId(id); setLoaded(false); setError(false); };
  const refresh = () => { setLoaded(false); setError(false); setRefreshKey(key => key + 1); };

  return (
    <div style={{ height: "calc(100vh - 105px)", minHeight: 600, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 700 }}>📁 Drive Esprit Padel</h2>
          <div style={{ fontSize: 12, color: "#6B7280" }}>Naviguez dans les dossiers partagés sans quitter l’application</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={refresh} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", fontWeight: 700, color: "#475569" }}>↻ Actualiser</button>
          <a href={`https://drive.google.com/drive/folders/${spaceId}`} target="_blank" rel="noreferrer" style={{ padding: "8px 13px", borderRadius: 8, background: "#0F56B8", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>↗ Ouvrir le dossier</a>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: 0, border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
        <aside style={{ width: isMobile ? "100%" : 205, flexShrink: 0, padding: 12, background: "#F8FAFC", borderRight: isMobile ? "none" : "1px solid #E2E8F0", borderBottom: isMobile ? "1px solid #E2E8F0" : "none", overflowX: isMobile ? "auto" : "visible" }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".08em", margin: "4px 8px 9px" }}>Espaces Drive</div>
          <div style={{ display: "flex", flexDirection: isMobile ? "row" : "column", gap: 5 }}>{visibleSpaces.map(space => <button key={space.id} onClick={() => changeSpace(space.id)} style={{ display: "flex", alignItems: "center", gap: 9, minWidth: isMobile ? 140 : "auto", padding: "9px 10px", border: "none", borderRadius: 9, background: spaceId === space.id ? "#E8F0FC" : "transparent", color: spaceId === space.id ? "#0F56B8" : "#475569", fontWeight: spaceId === space.id ? 800 : 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}><span style={{ width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", background: `${space.color}18` }}>{space.icon}</span><span style={{ fontSize: 11 }}>{space.name}</span></button>)}</div>
          {!isMobile && <div style={{ marginTop: 18, padding: 10, borderRadius: 10, background: "#fff", border: "1px solid #E2E8F0", fontSize: 10, color: "#64748B", lineHeight: 1.5 }}><strong style={{ color: "#334155" }}>Navigation</strong><br />Double-cliquez sur un dossier pour l’ouvrir. Utilisez le fil d’Ariane Google pour revenir en arrière.</div>}
        </aside>

        <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ minHeight: 48, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid #E2E8F0", background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}><button onClick={() => changeSpace(defaultSpace.id)} style={{ border: 0, background: "transparent", color: "#64748B", cursor: "pointer", fontWeight: 700 }}>Drive</button><span style={{ color: "#CBD5E1" }}>›</span><strong style={{ color: activeSpace.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeSpace.name}</strong></div>
            <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 8, padding: 2 }}><button onClick={() => { setView("grid"); setLoaded(false); }} style={{ padding: "6px 10px", borderRadius: 6, border: 0, background: view === "grid" ? "#fff" : "transparent", cursor: "pointer", fontWeight: 700, boxShadow: view === "grid" ? "0 1px 3px #0001" : "none" }}>⊞</button><button onClick={() => { setView("list"); setLoaded(false); }} style={{ padding: "6px 10px", borderRadius: 6, border: 0, background: view === "list" ? "#fff" : "transparent", cursor: "pointer", fontWeight: 700, boxShadow: view === "list" ? "0 1px 3px #0001" : "none" }}>☰</button></div>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: "relative", background: "#F8FAFC" }}>
            {!loaded && !error && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#64748B" }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 38 }}>📂</div><div style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>Ouverture de {activeSpace.name}…</div></div></div>}
            {error && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}><div><div style={{ fontSize: 42 }}>🔒</div><strong>Affichage intégré indisponible</strong><div style={{ fontSize: 11, color: "#64748B", margin: "8px 0 14px" }}>Ouvrez le dossier courant dans Google Drive.</div><a href={`https://drive.google.com/drive/folders/${spaceId}`} target="_blank" rel="noreferrer" style={{ padding: "9px 14px", borderRadius: 8, background: "#0F56B8", color: "#fff", textDecoration: "none", fontWeight: 700 }}>Ouvrir le dossier</a></div></div>}
            <iframe key={`${spaceId}-${view}-${refreshKey}`} src={embedUrl} onLoad={() => setLoaded(true)} onError={() => setError(true)} style={{ width: "100%", height: "100%", border: 0, display: "block", opacity: loaded ? 1 : 0, transition: "opacity .2s" }} title={`Drive ${activeSpace.name}`} allow="autoplay; encrypted-media" />
          </div>
        </section>
      </div>
    </div>
  );
}




// ==================== CALENDAR (FULL) ====================
function CalendarPage({ meetings, setMeetings, tasks, setTasks, calendarEvents, setCalendarEvents, currentUserId, isAdmin, campagnes, tournaments }) {
  const [viewMode, setViewMode] = useState("month");
  const [viewDate, setViewDate] = useState(new Date().toISOString().split("T")[0]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", date: "", endDate: "", time: "09:00", visibility: "me", color: "#0F56B8", notes: "", recurrence: "Aucune" });
  const [detailEvent, setDetailEvent] = useState(null);
  const [calFilters, setCalFilters] = useState({ meetings: true, tasks: true, events: true, campagnes: true, tournaments: true });
  const recurrenceOptions = ["Aucune","Quotidienne","Hebdomadaire","Bi-mensuelle","Mensuelle","Annuelle"].map(r => ({ value: r, label: r }));

  const d = new Date(viewDate);
  const year = d.getFullYear();
  const month = d.getMonth();
  const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const todayStr = new Date().toISOString().split("T")[0];

  const generateRecurrences = (startDate, rec) => { const dates = []; const sd = new Date(startDate); for (let i = 1; i <= 12; i++) { const nd = new Date(sd); if (rec === "Quotidienne") nd.setDate(nd.getDate() + i); else if (rec === "Hebdomadaire") nd.setDate(nd.getDate() + i * 7); else if (rec === "Bi-mensuelle") nd.setDate(nd.getDate() + i * 14); else if (rec === "Mensuelle") nd.setMonth(nd.getMonth() + i); else if (rec === "Annuelle") nd.setFullYear(nd.getFullYear() + i); dates.push(nd.toISOString().split("T")[0]); } return dates; };

  const openNew = (date) => { setEditing(null); setForm({ title: "", date: date || viewDate, endDate: "", time: "09:00", visibility: "me", color: "#0F56B8", notes: "", recurrence: "Aucune" }); setModalOpen(true); };
  const openEdit = (ev) => { if (String(ev.owner) !== String(currentUserId) && !isAdmin) return; setEditing(ev.id); setForm({ title: ev.title, date: ev.date, endDate: ev.endDate || "", time: ev.time, visibility: ev.visibility, color: ev.color, notes: ev.notes || "", recurrence: ev.recurrence || "Aucune" }); setModalOpen(true); };

  const save = () => {
    if (!form.title) return;
    const baseEvent = { ...form, type: "event", owner: currentUserId };
    if (editing) {
      setCalendarEvents(p => { let u = p.filter(e => String(e.id) !== String(editing) && String(e.parentId) !== String(editing)); u.push({ ...baseEvent, id: editing }); if (form.recurrence !== "Aucune") generateRecurrences(form.date, form.recurrence).forEach(rd => { u.push({ ...baseEvent, id: uid(), date: rd, parentId: editing }); }); return u; });
    } else {
      const mainId = uid();
      setCalendarEvents(p => { const n = [{ ...baseEvent, id: mainId }]; if (form.recurrence !== "Aucune") generateRecurrences(form.date, form.recurrence).forEach(rd => { n.push({ ...baseEvent, id: uid(), date: rd, parentId: mainId }); }); return [...p, ...n]; });
    }
    setModalOpen(false);
  };

  const del = (id) => { const ev = calendarEvents.find(e => String(e.id) === String(id)); if (ev && String(ev.owner) !== String(currentUserId) && !isAdmin) return; setCalendarEvents(p => p.filter(e => String(e.id) !== String(id) && String(e.parentId) !== String(id))); setDetailEvent(null); };

  const getDateItems = (dateStr) => {
    if (!dateStr) return { meetings: [], tasks: [], events: [], campagnes: [], tournaments: [] };
    const dm = calFilters.meetings ? meetings.filter(m => m.date === dateStr) : [];
    const dt = calFilters.tasks ? tasks.filter(t => t.deadline === dateStr && t.status !== "Terminé") : [];
    const de = calFilters.events ? calendarEvents.filter(e => e.date === dateStr && (e.visibility === "all" || String(e.owner) === String(currentUserId))) : [];
    // Campaign planning actions for this date
    const dc = calFilters.campagnes ? (campagnes||[]).filter(c => c.published || isAdmin).flatMap(camp =>
      (camp.timeline||[]).filter(t => {
        if (!t.date || ["Quotidien","3 fois/semaine","Chaque semaine","En continu","Selon besoin"].includes(t.date)) return false;
        if (t.date.includes("|")) { const [d1, d2] = t.date.split("|"); return dateStr >= d1 && dateStr <= d2; }
        return t.date === dateStr;
      }).map(t => ({ id: `camp-${camp.id}-${t.id}`, title: `${camp.name} — ${t.label}`, phase: t.phase, campName: camp.name, done: t.done }))
    ) : [];
    // Tournaments for this date
    const dt2 = calFilters.tournaments ? (tournaments||[]).filter(t => {
      const key = `${t.year}-${String(t.month+1).padStart(2,"0")}`;
      return dateStr.startsWith(key);
    }).flatMap(t => (t.entries||[]).filter(e => {
      if (!e.date) return false;
      const full = `${t.year}-${String(t.month+1).padStart(2,"0")}-${String(e.date).padStart(2,"0")}`;
      return full === dateStr;
    }).map(e => ({ id: `tourn-${t.id}-${e.id||e.date}`, title: e.name || e.category || "Tournoi", category: e.category }))) : [];
    return { meetings: dm, tasks: dt, events: de, campagnes: dc, tournaments: dt2 };
  };

  // Navigation
  const prevPeriod = () => { const nd = new Date(viewDate); if (viewMode === "month") nd.setMonth(nd.getMonth() - 1); else nd.setDate(nd.getDate() - (viewMode === "2days" ? 2 : 7)); setViewDate(nd.toISOString().split("T")[0]); };
  const nextPeriod = () => { const nd = new Date(viewDate); if (viewMode === "month") nd.setMonth(nd.getMonth() + 1); else nd.setDate(nd.getDate() + (viewMode === "2days" ? 2 : 7)); setViewDate(nd.toISOString().split("T")[0]); };

  // Month cells
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  // Week/2days dates
  const getDateRange = () => {
    const dates = [];
    const start = new Date(viewDate);
    const count = viewMode === "2days" ? 2 : 7;
    if (viewMode === "week") { const day = start.getDay(); start.setDate(start.getDate() - (day === 0 ? 6 : day - 1)); }
    for (let i = 0; i < count; i++) { const nd = new Date(start); nd.setDate(nd.getDate() + i); dates.push(nd.toISOString().split("T")[0]); }
    return dates;
  };

  const renderItem = (item, type) => { const colors = { meeting: "#6366F1", task: "#F59E0B", schedule: "#94A3B8" }; const icons = { meeting: "🤝", task: "☑", schedule: "📋" }; return (<div key={`${type}-${item.id}`} style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, marginBottom: 2, background: colors[type] + "15", color: colors[type], fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{icons[type]} {(item.title || item.activity || "").slice(0, 18)}</div>); };
  const renderEvent = (ev) => (<div key={ev.id} onClick={e => { e.stopPropagation(); setDetailEvent(ev.id); }} style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, marginBottom: 2, background: ev.color + "15", color: ev.color, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", maxWidth: "100%" }}>{ev.recurrence !== "Aucune" ? "🔄" : "📅"} {(ev.title || "").slice(0, 18)}</div>);

  // Detail event
  const evDetail = detailEvent ? calendarEvents.find(e => String(e.id) === String(detailEvent)) : null;

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Calendrier</h2>
      <div style={{ display: "flex", gap: 4 }}>
        {["month","week","2days"].map(m => <button key={m} onClick={() => setViewMode(m)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: viewMode === m ? "#0F56B8" : "#F1F5F9", color: viewMode === m ? "#fff" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{m === "month" ? "Mois" : m === "week" ? "Semaine" : "2 jours"}</button>)}
        <Btn onClick={() => openNew()} small>+ Événement</Btn>
        <button onClick={() => { const all = [...calendarEvents.filter(e => e.visibility === "all" || String(e.owner) === String(currentUserId)), ...meetings].filter(e => e.date); if (all.length > 0) downloadMultiICS(all); }} style={{ padding: "5px 12px", borderRadius: 8, border: "1.5px solid #10B981", background: "#10B98110", color: "#10B981", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📲 Exporter .ics</button>
      </div>
    </div>

    {/* Filters */}
    <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
      {[
        { key: "events", label: "📅 Événements", color: "#0F56B8" },
        { key: "meetings", label: "🤝 Réunions", color: "#6366F1" },
        { key: "tasks", label: "☑ Tâches", color: "#F59E0B" },
        { key: "campagnes", label: "📢 Campagnes", color: "#EC4899" },
        { key: "tournaments", label: "🏆 Tournois", color: "#10B981" },
      ].map(f => (
        <button key={f.key} onClick={() => setCalFilters(p => ({ ...p, [f.key]: !p[f.key] }))} style={{ padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${calFilters[f.key] ? f.color : "#E2E8F0"}`, background: calFilters[f.key] ? f.color + "10" : "transparent", color: calFilters[f.key] ? f.color : "#CBD5E1", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{f.label}</button>
      ))}
    </div>

    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={prevPeriod} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6B7280" }}>←</button>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{viewMode === "month" ? `${monthNames[month]} ${year}` : viewMode === "2days" ? `${new Date(viewDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : `Semaine du ${new Date(getDateRange()[0]).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}</span>
        <button onClick={nextPeriod} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6B7280" }}>→</button>
      </div>

      {/* MONTH VIEW */}
      {viewMode === "month" && (<div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(dd => <div key={dd} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#94A3B8", padding: 6 }}>{dd}</div>)}
        {cells.map((dd, i) => { const dateStr = dd ? `${year}-${String(month + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}` : null; const items = getDateItems(dateStr); const isToday = dateStr === todayStr; return (<div key={i} onClick={() => dd && openNew(dateStr)} style={{ minHeight: 80, maxHeight: 110, padding: 4, borderRadius: 8, background: isToday ? "#EFF6FF" : dd ? "#FAFBFC" : "transparent", border: isToday ? "1.5px solid #0F56B8" : "1px solid #F1F5F9", cursor: dd ? "pointer" : "default", overflow: "hidden" }}>{dd && <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? "#0F56B8" : "#475569", marginBottom: 2 }}>{dd}</div>}{items.meetings.map(m => renderItem(m, "meeting"))}{items.tasks.map(t => renderItem(t, "task"))}{items.events.map(ev => renderEvent(ev))}{items.campagnes.map(c => (<div key={c.id} style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, marginBottom: 2, background: "#EC489915", color: "#EC4899", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>📢 {c.title.slice(0, 18)}</div>))}{items.tournaments.map(t => (<div key={t.id} style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, marginBottom: 2, background: "#10B98115", color: "#10B981", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>🏆 {t.title.slice(0, 18)}</div>))}</div>); })}
      </div>)}

      {/* WEEK / 2DAYS VIEW */}
      {(viewMode === "week" || viewMode === "2days") && (() => {
        const dates = getDateRange();
        const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7h to 20h
        return (<div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: `50px repeat(${dates.length}, 1fr)`, gap: 0 }}>
            <div />
            {dates.map(ds => { const isToday = ds === todayStr; return <div key={ds} style={{ textAlign: "center", padding: 8, fontWeight: isToday ? 700 : 600, fontSize: 12, color: isToday ? "#0F56B8" : "#475569", background: isToday ? "#EFF6FF" : "transparent", borderBottom: "2px solid #E2E8F0" }}>{new Date(ds).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}</div>; })}
          </div>
          {hours.map(h => (<div key={h} style={{ display: "grid", gridTemplateColumns: `50px repeat(${dates.length}, 1fr)`, gap: 0, minHeight: 50, borderBottom: "1px solid #F4F2EF" }}>
            <div style={{ fontSize: 10, color: "#94A3B8", padding: "4px 6px", fontFamily: "JetBrains Mono, monospace" }}>{String(h).padStart(2, "0")}:00</div>
            {dates.map(ds => { const items = getDateItems(ds); const hourEvents = items.events.filter(e => parseInt(e.time) === h); const hourMeetings = items.meetings.filter(m => parseInt(m.time) === h); const hourCampagnes = h === 8 ? items.campagnes : []; const hourTournaments = h === 8 ? items.tournaments : []; return (<div key={ds} onClick={() => openNew(ds)} style={{ borderLeft: "1px solid #F4F2EF", padding: 2, cursor: "pointer", minHeight: 48 }}>{hourEvents.map(ev => renderEvent(ev))}{hourMeetings.map(m => renderItem(m, "meeting"))}{hourCampagnes.map(c => (<div key={c.id} style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, marginBottom: 2, background: "#EC489915", color: "#EC4899", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📢 {c.title.slice(0, 20)}</div>))}{hourTournaments.map(t => (<div key={t.id} style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, marginBottom: 2, background: "#10B98115", color: "#10B981", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🏆 {t.title.slice(0, 20)}</div>))}</div>); })}
          </div>))}
        </div>);
      })()}
    </Card>

    {/* Event detail overlay */}
    {evDetail && (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 998, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDetailEvent(null)}>
      <Card style={{ width: 360, padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
          <div><div style={{ fontSize: 16, fontWeight: 700, color: evDetail.color }}>{evDetail.title}</div><div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>📅 {evDetail.date}{evDetail.endDate && ` → ${evDetail.endDate}`} · {evDetail.time}</div>{evDetail.recurrence !== "Aucune" && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>🔄 {evDetail.recurrence}</div>}{evDetail.notes && <div style={{ fontSize: 12, color: "#2D2D30", marginTop: 8, lineHeight: 1.6 }}>{evDetail.notes}</div>}</div>
          <button onClick={() => setDetailEvent(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#94A3B8" }}>✕</button>
        </div>
        {(String(evDetail.owner) === String(currentUserId) || isAdmin) && (<div style={{ display: "flex", gap: 8, marginBottom: 8 }}><Btn onClick={() => { openEdit(evDetail); setDetailEvent(null); }} small>✏️ Modifier</Btn><Btn onClick={() => del(evDetail.id)} small outline color="#EF4444">🗑️ Supprimer</Btn></div>)}
        <button onClick={() => downloadICS(evDetail.title, evDetail.date, evDetail.time, null, evDetail.notes, "")} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1.5px solid #10B981", background: "#10B98110", color: "#10B981", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📲 Ajouter au calendrier</button>
      </Card>
    </div>)}

    {/* Create/Edit modal */}
    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier l'événement" : "Nouvel événement"}>
      <Input label="Titre" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}><Input label="Date début" value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} type="date" /><Input label="Date fin" value={form.endDate} onChange={v => setForm(p => ({ ...p, endDate: v }))} type="date" /><Input label="Heure" value={form.time} onChange={v => setForm(p => ({ ...p, time: v }))} type="time" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}><Select label="Visibilité" value={form.visibility} onChange={v => setForm(p => ({ ...p, visibility: v }))} options={[{ value: "me", label: "🔒 Moi seul" }, { value: "all", label: "👥 Tout le monde" }]} /><Select label="Récurrence" value={form.recurrence} onChange={v => setForm(p => ({ ...p, recurrence: v }))} options={recurrenceOptions} /></div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>{["#0F56B8","#10B981","#F59E0B","#EF4444","#6366F1","#EC4899","#FB8500"].map(c => <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: form.color === c ? "3px solid #2D2D30" : "2px solid transparent", cursor: "pointer" }} />)}</div>
      <Textarea label="Notes" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} />
      <div style={{ display: "flex", gap: 8 }}><Btn onClick={save}>{editing ? "Enregistrer" : "Créer"}</Btn>{editing && <Btn onClick={() => { del(editing); setModalOpen(false); }} color="#EF4444" outline>Supprimer</Btn>}</div>
    </Modal>
  </div>);
}

// ==================== TOURNAMENTS (FULL) ====================
function TournamentsPage({ clubs, tournaments, setTournaments, users, currentUserId, currentUser, isAdmin }) {
  const [clubFilter, setClubFilter] = useState(null);
  const [catFilter, setCatFilter] = useState(null);
  const [genderFilter, setGenderFilter] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tourViewMode, setTourViewMode] = useState("list");
  const myClubs = isAdmin ? clubs : clubs.filter(c => (currentUser?.clubs || []).some(uc => String(uc) === String(c.id)));
  const availableClubs = isAdmin ? clubs : myClubs;
  const [form, setForm] = useState({ club: "", title: "", date: "", time: "09:00", category: "P250", gender: "Mixte", description: "" });
  const [viewMonth, setViewMonth] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });
  const PADEL_CATEGORIES = [{ id: "P25", label: "P25", color: "#6FE7D8" }, { id: "P50", label: "P50", color: "#22C55E" }, { id: "P100", label: "P100", color: "#F2994A" }, { id: "P250", label: "P250", color: "#F2C94C" }, { id: "P500", label: "P500", color: "#EB5757" }, { id: "P1000", label: "P1000", color: "#FFFFFF" }, { id: "P1500", label: "P1500", color: "#7B61FF" }, { id: "P2000", label: "P2000", color: "#2D2D30" }, { id: "LOISIR", label: "LOISIR", color: "#F472B6" }];
  const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const { year, month } = viewMonth;

  const filtered = tournaments.filter(t => { const dd = new Date(t.date); return dd.getFullYear() === year && dd.getMonth() === month && (!clubFilter || String(t.club) === String(clubFilter)) && (!catFilter || t.category === catFilter) && (!genderFilter || t.gender === genderFilter); }).sort((a, b) => a.date.localeCompare(b.date));

  const openNew = () => { try { setEditing(null); setForm({ club: String(availableClubs[0]?.id || ""), title: "", date: "", time: "09:00", category: "P250", gender: "Mixte", description: "" }); setModalOpen(true); } catch(e) { alert("ERREUR: " + e.message); } };
  const openEdit = (t) => { setEditing(t.id); setForm({ club: t.club, title: t.title, date: t.date, time: t.time || "09:00", category: t.category || "P250", gender: t.gender || "Mixte", description: t.description || "" }); setModalOpen(true); };
  const save = () => { 
    if (!form.title) { alert("Veuillez saisir un titre"); return; }
    if (!form.date) { alert("Veuillez saisir une date"); return; }
    if (editing) {
      setTournaments(p => p.map(t => String(t.id) === String(editing) ? { ...t, ...form } : t));
    } else {
      setTournaments(p => [...p, { id: uid(), ...form, owner: String(currentUserId) }]);
    }
    setModalOpen(false); 
  };
  const del = (id) => setTournaments(p => p.filter(t => String(t.id) !== String(id)));
  const getCat = (id) => PADEL_CATEGORIES.find(c => String(c.id) === String(id)) || PADEL_CATEGORIES[3];

  // ── PDF + yearly stats (injected) ──────────────────────────────────
  const downloadMonthPDF = () => {
    const clubName = (id) => clubs.find(c => String(c.id) === String(id))?.name || "—";
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tournois ${monthNames[month]} ${year}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#2D2D30}.page{padding:20mm 15mm;max-width:210mm;margin:0 auto}.header{background:linear-gradient(135deg,#1E3A5F,#0F56B8);color:#fff;padding:24px 28px;margin-bottom:22px;border-radius:12px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:22px;margin:0}.hcount{font-size:36px;font-weight:800}.stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.stat{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 12px;text-align:center}.sv{font-size:20px;font-weight:800}.sl{font-size:8px;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:2px}table{width:100%;border-collapse:collapse}th{background:#1E3A5F;color:#fff;padding:9px 12px;font-size:10px;text-align:left;font-weight:700;letter-spacing:0.5px;text-transform:uppercase}td{padding:9px 12px;font-size:11px;border-bottom:1px solid #F1F5F9}.cat{display:inline-block;padding:2px 9px;border-radius:5px;font-size:10px;font-weight:800}.footer{margin-top:18px;padding-top:8px;border-top:1px solid #E2E8F0;color:#94A3B8;font-size:8px;text-align:center}.pb{position:fixed;top:16px;right:16px;padding:9px 18px;background:#0F56B8;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;z-index:999}@media print{.pb{display:none!important}.page{padding:10mm}}</style></head><body><button class="pb" onclick="window.print()">🖨️ Imprimer / PDF</button><div class="page"><div class="header"><div><h1>🏆 Tournois</h1><div style="font-size:11px;opacity:.7;margin-top:3px">${monthNames[month].toUpperCase()} ${year}</div></div><div class="hcount">${filtered.length}</div></div>`;
    const catStats = PADEL_CATEGORIES.map(c => ({ ...c, cnt: filtered.filter(t => t.category === c.id).length })).filter(c => c.cnt > 0);
    html += `<div class="stats">${catStats.map(c => `<div class="stat" style="border-top:3px solid ${c.color==="#FFFFFF"?"#CBD5E1":c.color}"><div class="sv" style="color:${c.color==="#FFFFFF"?"#2D2D30":c.color}">${c.cnt}</div><div class="sl">${c.label}</div></div>`).join("")}</div>`;
    html += `<table><thead><tr><th>Date</th><th>Heure</th><th>Titre</th><th>Catégorie</th><th>Genre</th><th>Club</th></tr></thead><tbody>`;
    filtered.forEach(t => { const cat = getCat(t.category); const iw = cat.color==="#FFFFFF"; const ds = new Date(t.date+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"2-digit",month:"short"}); html += `<tr><td style="font-weight:600">${ds}</td><td style="color:#94A3B8;font-family:monospace">${t.time||"—"}</td><td style="font-weight:600">${t.title}</td><td><span class="cat" style="background:${cat.color};color:${iw?"#2D2D30":"#fff"};${iw?"border:1.5px solid #CBD5E1":""}">${cat.label}</span></td><td>${t.gender||"—"}</td><td>${clubName(t.club)}</td></tr>`; });
    html += `</tbody></table><div class="footer">Esprit Padel — Tournois ${monthNames[month]} ${year} — ${new Date().toLocaleDateString("fr-FR")}</div></div></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" }); const url = URL.createObjectURL(blob); const w = window.open(url, "_blank"); if (!w) { const a = document.createElement("a"); a.href = url; a.download = `Tournois_${monthNames[month]}_${year}.html`; a.click(); } setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const yearlyStats = Array.from({ length: 12 }, (_, mi) => { const mt = tournaments.filter(t => { const d = new Date(t.date); return d.getFullYear() === year && d.getMonth() === mi && (!clubFilter || String(t.club) === String(clubFilter)); }); return { mi, label: monthNames[mi].slice(0,3), total: mt.length, bycat: Object.fromEntries(PADEL_CATEGORIES.map(c => [c.id, mt.filter(t => t.category === c.id).length])) }; });
  const maxTotal = Math.max(...yearlyStats.map(s => s.total), 1);

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
      <div><h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>🏆 Tournois</h2><div style={{ fontSize: 12, color: "#94A3B8" }}>{filtered.length} tournois ce mois</div></div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => setTourViewMode("list")} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: tourViewMode === "list" ? "#0F56B8" : "#F1F5F9", color: tourViewMode === "list" ? "#fff" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📋 Liste</button>
        <button onClick={() => setTourViewMode("calendar")} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: tourViewMode === "calendar" ? "#0F56B8" : "#F1F5F9", color: tourViewMode === "calendar" ? "#fff" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📅 Calendrier</button>
        <button onClick={downloadMonthPDF} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#1E3A5F", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📥 PDF {monthNames[month]}</button>
        <button onClick={openNew} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0F56B8", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Nouveau tournoi</button>
      </div>
    </div>

    {/* Navigation + filters */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}><button onClick={() => setViewMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#6B7280" }}>←</button><span style={{ fontSize: 14, fontWeight: 700, width: 140, textAlign: "center" }}>{monthNames[month]} {year}</span><button onClick={() => setViewMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#6B7280" }}>→</button></div>
      <ClubFilter clubs={availableClubs} selected={clubFilter} onChange={setClubFilter} />
    </div>
    <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
      {PADEL_CATEGORIES.map(c => { const isWhite = c.color === "#FFFFFF"; return <button key={c.id} onClick={() => setCatFilter(catFilter === c.id ? null : c.id)} style={{ padding: "4px 10px", borderRadius: 8, background: catFilter === c.id ? c.color : "#F1F5F9", color: catFilter === c.id ? (isWhite ? "#2D2D30" : "#fff") : "#6B7280", border: catFilter === c.id && isWhite ? "2px solid #2D2D30" : "none", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{c.label}</button>; })}
      {["Homme","Femme","Mixte"].map(g => <button key={g} onClick={() => setGenderFilter(genderFilter === g ? null : g)} style={{ padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${genderFilter === g ? "#0F56B8" : "#E2E8F0"}`, background: genderFilter === g ? "#0F56B810" : "transparent", color: genderFilter === g ? "#0F56B8" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{g === "Homme" ? "♂️" : g === "Femme" ? "♀️" : "⚥"} {g}</button>)}
    </div>

    {/* Calendar view */}
    {tourViewMode === "calendar" && (() => {
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const off = firstDay === 0 ? 6 : firstDay - 1;
      const cels = [...Array(off).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
      return (<Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
          {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(dd => <div key={dd} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#94A3B8", padding: 6 }}>{dd}</div>)}
          {cels.map((dd, i) => { const dateStr = dd ? `${year}-${String(month + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}` : null; const dayTours = dateStr ? filtered.filter(t => t.date === dateStr) : []; const isToday = dateStr === new Date().toISOString().split("T")[0]; return (<div key={i} style={{ minHeight: 70, maxHeight: 100, padding: 4, borderRadius: 8, background: isToday ? "#EFF6FF" : dd ? "#FAFBFC" : "transparent", border: isToday ? "1.5px solid #0F56B8" : "1px solid #F1F5F9", overflow: "hidden" }}>{dd && <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? "#0F56B8" : "#475569", marginBottom: 2 }}>{dd}</div>}{dayTours.map(t => { const cat = getCat(t.category); return <div key={t.id} onClick={() => openEdit(t)} style={{ fontSize: 9, padding: "2px 4px", borderRadius: 4, marginBottom: 1, background: cat.color + "15", color: cat.color, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}>{cat.label} {(t.title || "").slice(0, 12)}</div>; })}</div>); })}
        </div>
      </Card>);
    })()}

    {/* List view */}
    {tourViewMode === "list" && (<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {filtered.length === 0 ? <Card style={{ padding: 30, textAlign: "center" }}><div style={{ color: "#94A3B8", fontSize: 13 }}>Aucun tournoi ce mois</div></Card> : filtered.map(t => { const cat = getCat(t.category); return (<Card key={t.id} style={{ padding: 14, borderLeft: `4px solid ${cat.color}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div><div style={{ fontSize: 14, fontWeight: 700 }}>{t.title}</div><div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>📅 {t.date} · {t.time} · {t.gender}</div>{t.description && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4, lineHeight: 1.5 }}>{t.description}</div>}</div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}><Badge text={cat.label} color={cat.color} /><ClubBadge clubId={t.club} clubs={clubs} /><button onClick={() => openEdit(t)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11 }}>✏️</button><button onClick={() => del(t.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#EF4444" }}>🗑️</button></div>
        </div>
      </Card>); })}
    </div>)}

    {/* Modal */}
    {/* ── Yearly stats table ── */}
    <Card style={{ padding: 14, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30" }}>📊 Bilan annuel — {year}</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["Homme","Femme","Mixte"].map(g => <span key={g} style={{ padding: "2px 8px", borderRadius: 6, background: "#F1F5F9", color: "#6B7280", fontSize: 10, fontWeight: 600 }}>{g}</span>)}
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #E2E8F0" }}>
              <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#6B7280", minWidth: 70 }}>Catégorie</th>
              {monthNames.map((mn, mi) => {
                const isCur = mi === month;
                return <th key={mi} onClick={() => setViewMonth({ year, month: mi })} style={{ padding: "6px 4px", textAlign: "center", fontSize: 10, fontWeight: isCur ? 800 : 600, color: isCur ? "#0F56B8" : "#6B7280", cursor: "pointer", minWidth: 36, background: isCur ? "#EFF6FF" : "transparent", borderRadius: isCur ? "6px 6px 0 0" : 0 }}>{mn.slice(0,3)}</th>;
              })}
              <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "#2D2D30", minWidth: 44 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {PADEL_CATEGORIES.map(cat => {
              const isWhite = cat.color === "#FFFFFF";
              const monthCounts = Array.from({ length: 12 }, (_, mi) => {
                const mt = tournaments.filter(t => { const d = new Date(t.date); return d.getFullYear() === year && d.getMonth() === mi && t.category === cat.id && (!clubFilter || String(t.club) === String(clubFilter)); });
                return { total: mt.length, H: mt.filter(t => t.gender === "Homme").length, F: mt.filter(t => t.gender === "Femme").length, M: mt.filter(t => t.gender === "Mixte").length };
              });
              const yearTotal = monthCounts.reduce((s, c) => s + c.total, 0);
              if (yearTotal === 0 && !isAdmin) return null;
              return (
                <tr key={cat.id} style={{ borderBottom: "1px solid #F4F2EF" }}>
                  <td style={{ padding: "7px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: cat.color, border: isWhite ? "1.5px solid #CBD5E1" : "none", flexShrink: 0, display: "inline-block" }} />
                      <span style={{ fontWeight: 700, fontSize: 11 }}>{cat.label}</span>
                    </div>
                  </td>
                  {monthCounts.map((c, mi) => {
                    const isCur = mi === month;
                    return (
                      <td key={mi} onClick={() => setViewMonth({ year, month: mi })} style={{ padding: "4px 3px", textAlign: "center", cursor: "pointer", background: isCur ? "#EFF6FF" : "transparent" }}>
                        {c.total > 0 ? (
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13, color: isWhite ? "#2D2D30" : cat.color === "#F2C94C" ? "#B45309" : cat.color }}>{c.total}</div>
                            <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 1 }}>
                              {c.H > 0 && <span style={{ fontSize: 7, background: "#3B82F615", color: "#3B82F6", borderRadius: 3, padding: "0 3px", fontWeight: 600 }}>H{c.H}</span>}
                              {c.F > 0 && <span style={{ fontSize: 7, background: "#EC489915", color: "#EC4899", borderRadius: 3, padding: "0 3px", fontWeight: 600 }}>F{c.F}</span>}
                              {c.M > 0 && <span style={{ fontSize: 7, background: "#10B98115", color: "#10B981", borderRadius: 3, padding: "0 3px", fontWeight: 600 }}>M{c.M}</span>}
                            </div>
                          </div>
                        ) : <span style={{ color: "#E2E8F0", fontSize: 10 }}>—</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 800, fontSize: 13, color: "#2D2D30", background: "#F8FAFC", borderRadius: 6 }}>{yearTotal > 0 ? yearTotal : "—"}</td>
                </tr>
              );
            })}
            {/* TOTAL row */}
            <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
              <td style={{ padding: "7px 8px", fontWeight: 700, fontSize: 11, color: "#2D2D30" }}>TOTAL</td>
              {yearlyStats.map((s, mi) => {
                const isCur = mi === month;
                return <td key={mi} onClick={() => setViewMonth({ year, month: mi })} style={{ padding: "7px 3px", textAlign: "center", fontWeight: 800, fontSize: 13, color: s.total > 0 ? "#0F56B8" : "#CBD5E1", cursor: "pointer", background: isCur ? "#EFF6FF" : "transparent" }}>{s.total > 0 ? s.total : "—"}</td>;
              })}
              <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 800, fontSize: 14, color: "#0F56B8" }}>{tournaments.filter(t => { const d = new Date(t.date); return d.getFullYear() === year && (!clubFilter || String(t.club) === String(clubFilter)); }).length}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 9, color: "#94A3B8" }}>
        <span style={{ background: "#3B82F615", color: "#3B82F6", borderRadius: 3, padding: "1px 5px", fontWeight: 600 }}>H = Homme</span>
        <span style={{ background: "#EC489915", color: "#EC4899", borderRadius: 3, padding: "1px 5px", fontWeight: 600 }}>F = Femme</span>
        <span style={{ background: "#10B98115", color: "#10B981", borderRadius: 3, padding: "1px 5px", fontWeight: 600 }}>M = Mixte</span>
        <span style={{ color: "#CBD5E1" }}>Cliquez sur un mois pour y naviguer</span>
      </div>
    </Card>

    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier le tournoi" : "Créer un tournoi"} wide>
      <Input label="Titre" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}><Select label="Club" value={String(form.club)} onChange={v => setForm(p => ({ ...p, club: v }))} options={availableClubs.map(c => ({ value: String(c.id), label: c.name }))} /><Input label="Date" value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} type="date" /><Input label="Heure" value={form.time} onChange={v => setForm(p => ({ ...p, time: v }))} type="time" /></div>
      <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Catégorie</label><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{PADEL_CATEGORIES.map(c => { const isWhite = c.color === "#FFFFFF"; const sel = form.category === c.id; return <button key={c.id} onClick={() => setForm(p => ({ ...p, category: c.id }))} style={{ padding: "6px 14px", borderRadius: 8, background: sel ? c.color : "#F1F5F9", color: sel ? (isWhite ? "#2D2D30" : "#fff") : "#6B7280", border: sel && isWhite ? "2px solid #2D2D30" : "none", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{c.label}</button>; })}</div></div>
      <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Genre</label><div style={{ display: "flex", gap: 6 }}>{["Homme","Femme","Mixte"].map(g => <button key={g} onClick={() => setForm(p => ({ ...p, gender: g }))} style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${form.gender === g ? "#0F56B8" : "#E2E8F0"}`, background: form.gender === g ? "#0F56B810" : "transparent", color: form.gender === g ? "#0F56B8" : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{g}</button>)}</div></div>
      <Textarea label="Description" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} />
      <Btn onClick={save}>{editing ? "Enregistrer" : "Créer"}</Btn>
    </Modal>
  </div>);
}

// ==================== DIRECTORY (FULL) ====================
function DirectoryPage({ clubs, users }) {
  const [search, setSearch] = useState("");
  const [clubFilter, setClubFilter] = useState(null);
  const filtered = users.filter(u => {
    const sMatch = !search || `${u.firstName} ${u.lastName} ${u.role} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    const cMatch = !clubFilter || (u.clubs || []).some(uc => String(uc) === String(clubFilter));
    return sMatch && cMatch;
  });
  return (<div>
    <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 700 }}>📇 Répertoire</h2>
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..." style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
      <ClubFilter clubs={clubs} selected={clubFilter} onChange={setClubFilter} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
      {filtered.map(u => (<Card key={u.id} style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Avatar name={`${u.firstName} ${u.lastName}`} size={44} color={["#6366F1","#EC4899","#10B981","#F59E0B"][u.id % 4]} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30" }}>{u.firstName} {u.lastName}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>{u.role}</div>
            {u.email && <a href={`mailto:${u.email}`} style={{ fontSize: 10, color: "#0F56B8", textDecoration: "none" }}>✉️ {u.email}</a>}
            {u.phone && <a href={`tel:${u.phone.replace(/\s/g, "")}`} style={{ display: "block", fontSize: 11, color: "#10B981", textDecoration: "none", marginTop: 2, fontWeight: 600 }}>📞 {u.phone}</a>}
          </div>
        </div>
        {(u.clubs || []).length > 0 && <div style={{ display: "flex", gap: 4, marginTop: 8 }}>{u.clubs.map(cid => <ClubBadge key={cid} clubId={cid} clubs={clubs} />)}</div>}
      </Card>))}
    </div>
  </div>);
}

// ==================== PROFILE (FULL) ====================
function ProfilePage({ users, setUsers, currentUserId, isAdmin, clubs, setClubs, currentUser, onlineUsers, activityLog, customPages, setCustomPages, addToast, competences, setCompetences }) {
  const [profTab, setProfTab] = useState("monprofil");
  const me = users.find(u => String(u.id) === String(currentUserId)) || users[0];
  const [form, setForm] = useState({});
  const [saved, setSaved] = useState(false);
  const [pwSection, setPwSection] = useState(false);
  const [oldPw, setOldPw] = useState(""); const [newPw, setNewPw] = useState(""); const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState({ text: "", ok: false });
  const [vacFrom, setVacFrom] = useState(""); const [vacTo, setVacTo] = useState("");

  useEffect(() => { if (me) setForm({ ...me }); }, [me]);

  const save = () => { setUsers(p => p.map(u => String(u.id) === String(form.id) ? { ...form } : u)); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const addVacation = () => { if (!vacFrom || !vacTo) return; setForm(p => ({ ...p, vacations: [...(p.vacations || []), { id: uid(), from: vacFrom, to: vacTo }] })); setVacFrom(""); setVacTo(""); };
  const delVacation = (id) => setForm(p => ({ ...p, vacations: (p.vacations || []).filter(v => String(v.id) !== String(id)) }));
  const changePassword = () => { if (!oldPw || !newPw) { setPwMsg({ text: "Remplissez tous les champs", ok: false }); return; } if (oldPw !== me?.password) { setPwMsg({ text: "Ancien mot de passe incorrect", ok: false }); return; } if (newPw !== confirmPw) { setPwMsg({ text: "Confirmation différente", ok: false }); return; } setUsers(p => p.map(u => String(u.id) === String(me.id) ? { ...u, password: newPw } : u)); setPwMsg({ text: "Mot de passe modifié ✅", ok: true }); setOldPw(""); setNewPw(""); setConfirmPw(""); };

  if (!me) return null;

  const TABS = [
    { id: "monprofil", label: "👤 Mon profil", show: true },
    { id: "teamtracking", label: "👥 Suivi équipe", show: isAdmin || currentUser?.role === "Directeur" },
    { id: "settings", label: "⚙ Paramètres", show: isAdmin },
  ];

  return (<div>
    <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 700 }}>Mon profil</h2>

    {(isAdmin || currentUser?.role === "Directeur") && (
      <div style={{ display: "flex", gap: 4, marginBottom: 18, flexWrap: "wrap" }}>
        {TABS.filter(t => t.show).map(t => (
          <button key={t.id} onClick={() => setProfTab(t.id)} style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: profTab === t.id ? "#0F56B8" : "#F1F5F9", color: profTab === t.id ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t.label}</button>
        ))}
      </div>
    )}

    {profTab === "teamtracking" && (isAdmin || currentUser?.role === "Directeur") && (
      <TeamTrackingPage users={users} clubs={clubs} currentUser={currentUser} currentUserId={currentUserId} isAdmin={isAdmin} onlineUsers={onlineUsers} />
    )}

    {profTab === "settings" && isAdmin && (
      <SettingsPage clubs={clubs} setClubs={setClubs} users={users} setUsers={setUsers} isAdmin={isAdmin} activityLog={activityLog} customPages={customPages} setCustomPages={setCustomPages} addToast={addToast} competences={competences} setCompetences={setCompetences} currentUserId={currentUserId} />
    )}

    {profTab === "monprofil" && (
    <Card style={{ maxWidth: 600 }}>
      <div style={{ display: "flex", gap: 20, marginBottom: 20 }}><Avatar name={`${form.firstName} ${form.lastName}`} size={64} color="#6366F1" /><div style={{ flex: 1 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}><Input label="Prénom" value={form.firstName || ""} onChange={v => setForm(p => ({ ...p, firstName: v }))} /><Input label="Nom" value={form.lastName || ""} onChange={v => setForm(p => ({ ...p, lastName: v }))} /></div><div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{form.role}</div></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}><Input label="Email" value={form.email || ""} onChange={v => setForm(p => ({ ...p, email: v }))} type="email" /><Input label="Téléphone" value={form.phone || ""} onChange={v => setForm(p => ({ ...p, phone: v }))} /></div>

      {/* Jours de congé */}
      <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Jours de congé</label><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"].map(dd => (<button key={dd} onClick={() => setForm(p => ({ ...p, daysOff: { ...(p.daysOff || {}), [dd]: !(p.daysOff || {})[dd] } }))} style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${(form.daysOff || {})[dd] ? "#EF4444" : "#E2E8F0"}`, background: (form.daysOff || {})[dd] ? "#FEE2E2" : "transparent", color: (form.daysOff || {})[dd] ? "#EF4444" : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{dd}</button>))}</div></div>

      {/* Vacances */}
      <div style={{ marginBottom: 12, padding: 14, background: "#F4F2EF", borderRadius: 12 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>🏖️ Vacances</label>
        {(form.vacations || []).map(v => (<div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>Du {v.from} au {v.to}</span><button onClick={() => delVacation(v.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#EF4444" }}>✕</button></div>))}
        <div style={{ display: "flex", gap: 6, alignItems: "end" }}><div><label style={{ fontSize: 10, color: "#94A3B8" }}>Du</label><input type="date" value={vacFrom} onChange={e => setVacFrom(e.target.value)} style={{ display: "block", padding: "4px 6px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 11 }} /></div><div><label style={{ fontSize: 10, color: "#94A3B8" }}>Au</label><input type="date" value={vacTo} onChange={e => setVacTo(e.target.value)} style={{ display: "block", padding: "4px 6px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 11 }} /></div><Btn onClick={addVacation} small>+</Btn></div>
      </div>

      {/* École - alternants only */}
      {me?.role === "Alternant communication" && (<div style={{ marginBottom: 12, padding: 14, background: "#F4F2EF", borderRadius: 12 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>🎓 Jours d'école</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{["Lundi","Mardi","Mercredi","Jeudi","Vendredi"].map(dd => (<button key={dd} onClick={() => setForm(p => ({ ...p, schoolDays: { ...(p.schoolDays || {}), [dd]: !(p.schoolDays || {})[dd] } }))} style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${(form.schoolDays || {})[dd] ? "#6366F1" : "#E2E8F0"}`, background: (form.schoolDays || {})[dd] ? "#6366F115" : "transparent", color: (form.schoolDays || {})[dd] ? "#6366F1" : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{dd}{(form.schoolDays || {})[dd] && " 🎓"}</button>))}</div>
      </div>)}

      {/* Notification preferences */}
      <div style={{ marginBottom: 12, padding: 14, background: "#F4F2EF", borderRadius: 12 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>🔔 Notifications</label>
        {[{ key: "notifTasks", label: "Tâches assignées" }, { key: "notifObjectives", label: "Objectifs" }, { key: "notifDeadlines", label: "Rappels deadline" }, { key: "notifProjects", label: "Projets" }].map(pref => { const enabled = (form.notifPrefs || {})[pref.key] !== false; return (<div key={pref.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}><span style={{ fontSize: 12, color: "#2D2D30" }}>{pref.label}</span><button onClick={() => setForm(p => ({ ...p, notifPrefs: { ...(p.notifPrefs || {}), [pref.key]: !enabled } }))} style={{ width: 40, height: 22, borderRadius: 11, border: "none", background: enabled ? "#10B981" : "#CBD5E1", cursor: "pointer", position: "relative" }}><span style={{ position: "absolute", top: 2, left: enabled ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s" }} /></button></div>); })}
      </div>

      {/* Theme colors */}
      <div style={{ marginBottom: 12, padding: 14, background: "#F4F2EF", borderRadius: 12 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>🎨 Couleurs</label>
        {[{ key: "primary", label: "Principale" }, { key: "accent", label: "Accent" }, { key: "sidebar", label: "Sidebar" }].map(c => (<div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><span style={{ fontSize: 11, color: "#6B7280", width: 70 }}>{c.label}</span><input type="color" value={(form.theme || {})[c.key] || "#0F56B8"} onChange={e => setForm(p => ({ ...p, theme: { ...(p.theme || DEFAULT_THEME), [c.key]: e.target.value } }))} style={{ width: 30, height: 24, border: "none", borderRadius: 4, cursor: "pointer" }} /></div>))}
      </div>

      {/* Password */}
      <div style={{ marginBottom: 12, padding: 14, background: "#F4F2EF", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>🔒 Mot de passe</label><button onClick={() => setPwSection(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#0F56B8", fontWeight: 600, fontFamily: "inherit" }}>{pwSection ? "Annuler" : "Modifier"}</button></div>
        {pwSection && (<div style={{ marginTop: 8 }}><input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} placeholder="Ancien" style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", marginBottom: 6, boxSizing: "border-box" }} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Nouveau" style={{ padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit" }} /><input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirmer" style={{ padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit" }} /></div>{pwMsg.text && <div style={{ padding: "4px 8px", borderRadius: 6, background: pwMsg.ok ? "#F0FDF4" : "#FEF2F2", color: pwMsg.ok ? "#10B981" : "#EF4444", fontSize: 11, marginTop: 6 }}>{pwMsg.text}</div>}<Btn onClick={changePassword} small style={{ marginTop: 6 }}>Changer</Btn></div>)}
      </div>

      {/* Password vault - personal & private */}
      <div style={{ marginBottom: 12, padding: 14, background: "#F4F2EF", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>🔐 Mes identifiants</label>
          <button onClick={() => setForm(p => ({ ...p, vault: [...(p.vault || []), { id: uid(), platform: "", login: "", password: "", show: false }] }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#0F56B8", fontWeight: 600, fontFamily: "inherit" }}>+ Ajouter</button>
        </div>
        <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 8 }}>Stockez vos identifiants en toute sécurité. Visible uniquement par vous.</div>
        {(form.vault || []).map(v => (
          <div key={v.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, padding: 8, background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0" }}>
            <select value={v.platform} onChange={e => setForm(p => ({ ...p, vault: (p.vault || []).map(x => x.id === v.id ? { ...x, platform: e.target.value } : x) }))} style={{ padding: "4px 6px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit", width: 110 }}>
              <option value="">Plateforme...</option>
              {["Instagram","Facebook","TikTok","LinkedIn","Twitter/X","Metricool","Canva","Google","Google Drive","Google My Business","Match Point","Odoo","YouTube","Mailchimp","WordPress","Autre"].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input value={v.login} onChange={e => setForm(p => ({ ...p, vault: (p.vault || []).map(x => x.id === v.id ? { ...x, login: e.target.value } : x) }))} placeholder="Identifiant / email" style={{ flex: 1, padding: "4px 6px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }} />
            <div style={{ position: "relative", flex: 1 }}>
              <input type={v.show ? "text" : "password"} value={v.password} onChange={e => setForm(p => ({ ...p, vault: (p.vault || []).map(x => x.id === v.id ? { ...x, password: e.target.value } : x) }))} placeholder="Mot de passe" style={{ width: "100%", padding: "4px 26px 4px 6px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "JetBrains Mono, monospace", boxSizing: "border-box" }} />
              <button onClick={() => setForm(p => ({ ...p, vault: (p.vault || []).map(x => x.id === v.id ? { ...x, show: !x.show } : x) }))} style={{ position: "absolute", right: 4, top: 2, background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>{v.show ? "🙈" : "👁️"}</button>
            </div>
            <button onClick={() => setForm(p => ({ ...p, vault: (p.vault || []).filter(x => x.id !== v.id) }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#EF4444" }}>✕</button>
          </div>
        ))}
        {(form.vault || []).length === 0 && <div style={{ fontSize: 11, color: "#CBD5E1", fontStyle: "italic", textAlign: "center", padding: 10 }}>Aucun identifiant enregistré</div>}
      </div>

      <div style={{ display: "flex", gap: 8 }}><Btn onClick={save}>💾 Enregistrer</Btn>{saved && <span style={{ fontSize: 12, color: "#10B981", fontWeight: 600, display: "flex", alignItems: "center" }}>✅ Sauvegardé</span>}</div>
    </Card>
    )}
  </div>);
}

// ==================== NOTES ====================
function NotesPage({ notes, setNotes, users, currentUserId }) {
  const [activeNote, setActiveNote] = useState(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState(null);

  const me = currentUserId;
  const myNotes = notes.filter(n => String(n.owner) === String(me));
  const filtered = myNotes.filter(n => {
    const sMatch = !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase());
    const cMatch = !catFilter || n.category === catFilter;
    return sMatch && cMatch;
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const categories = ["Perso", "Travail", "Idées", "Réunion", "Autre"];
  const catColors = { Perso: "#0F56B8", Travail: "#059669", Idées: "#F59E0B", Réunion: "#FEB601", Autre: "#94A3B8" };

  const addNote = () => {
    const n = { id: uid(), title: "Nouvelle note", content: "", category: "Perso", owner: me, sharedWith: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), color: "#0F56B8" };
    setNotes(p => [n, ...p]);
    setActiveNote(n.id);
  };

  const updateNote = (id, updates) => {
    setNotes(p => p.map(n => String(n.id) === String(id) ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
  };

  const delNote = (id) => {
    const n = notes.find(x => String(x.id) === String(id));
    if (n && String(n.owner) !== String(me)) return;
    setNotes(p => p.filter(n => String(n.id) !== String(id)));
    if (activeNote === id) setActiveNote(null);
  };

  const toggleShare = (noteId, userId) => {
    setNotes(p => p.map(n => String(n.id) === String(noteId) ? { ...n, sharedWith: n.sharedWith.includes(userId) ? n.sharedWith.filter(x => x !== userId) : [...n.sharedWith, userId] } : n));
  };

  const exportPdf = (note) => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${note.title}</title><style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:20px;color:#2D2D30}h1{font-size:24px;margin-bottom:4px}p.meta{color:#94A3B8;font-size:12px;margin-bottom:20px}.content{font-size:14px;line-height:1.8;white-space:pre-wrap}footer{margin-top:40px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:10px;color:#94A3B8}</style></head><body><h1>${note.title}</h1><p class="meta">${note.category} · ${new Date(note.updatedAt).toLocaleDateString("fr-FR")}</p><div class="content">${note.content.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div><footer>Esprit Padel Communication — Note exportée le ${new Date().toLocaleDateString("fr-FR")}</footer></body></html>`;
    downloadAsPdf(html);
  };

  const copyNote = (note) => {
    navigator.clipboard.writeText(`${note.title}\n\n${note.content}`).catch(() => {});
  };

  const active = activeNote ? notes.find(n => String(n.id) === String(activeNote)) : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Mes Notes</h2>
        <Btn onClick={addNote}>+ Nouvelle note</Btn>
      </div>
      <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 16 }}>Espace personnel · {myNotes.length} notes</div>

      <div style={{ display: "grid", gridTemplateColumns: active ? "300px 1fr" : "1fr", gap: 16 }}>
        {/* Notes list */}
        <div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
            <button onClick={() => setCatFilter(null)} style={{ padding: "3px 10px", borderRadius: 14, border: `1.5px solid ${!catFilter ? "#0F56B8" : "#E2E8F0"}`, background: !catFilter ? "#0F56B810" : "transparent", color: !catFilter ? "#0F56B8" : "#94A3B8", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Toutes</button>
            {categories.map(c => (
              <button key={c} onClick={() => setCatFilter(catFilter === c ? null : c)} style={{ padding: "3px 10px", borderRadius: 14, border: `1.5px solid ${catFilter === c ? catColors[c] : "#E2E8F0"}`, background: catFilter === c ? catColors[c] + "15" : "transparent", color: catFilter === c ? catColors[c] : "#94A3B8", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{c}</button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: active ? "70vh" : "auto", overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "#94A3B8", fontSize: 12 }}>Aucune note</div>
            ) : filtered.map(n => (
              <div key={n.id} onClick={() => setActiveNote(n.id)} style={{ padding: 12, borderRadius: 10, background: activeNote === n.id ? (catColors[n.category] || "#0F56B8") + "10" : "#fff", border: `1.5px solid ${activeNote === n.id ? catColors[n.category] || "#0F56B8" : "#F1F5F9"}`, cursor: "pointer", transition: "all .15s", borderLeft: `4px solid ${catColors[n.category] || "#94A3B8"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30" }}>{n.title || "Sans titre"}</span>
                  {n.sharedWith.length > 0 && <span style={{ fontSize: 10, color: "#94A3B8" }}>👥 {n.sharedWith.length}</span>}
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.content.slice(0, 80) || "Note vide..."}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                  <Badge text={n.category} color={catColors[n.category] || "#94A3B8"} small />
                  <span style={{ fontSize: 9, color: "#CBD5E1" }}>{new Date(n.updatedAt).toLocaleDateString("fr-FR")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Note editor */}
        {active && (
          <Card style={{ display: "flex", flexDirection: "column", height: "fit-content" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <input value={active.title} onChange={e => updateNote(active.id, { title: e.target.value })} placeholder="Titre de la note..." style={{ fontSize: 18, fontWeight: 700, color: "#2D2D30", border: "none", outline: "none", flex: 1, fontFamily: "inherit", background: "transparent" }} readOnly={String(active.owner) !== String(me)} />
              <button onClick={() => setActiveNote(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#94A3B8" }}>✕</button>
            </div>

            {/* Category + meta */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
              {String(active.owner) === String(me) && categories.map(c => (
                <button key={c} onClick={() => updateNote(active.id, { category: c })} style={{ padding: "3px 10px", borderRadius: 14, border: `1.5px solid ${active.category === c ? catColors[c] : "#E2E8F0"}`, background: active.category === c ? catColors[c] + "15" : "transparent", color: active.category === c ? catColors[c] : "#94A3B8", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{c}</button>
              ))}
              {String(active.owner) !== String(me) && <Badge text={active.category} color={catColors[active.category] || "#94A3B8"} />}
              <span style={{ fontSize: 9, color: "#CBD5E1", marginLeft: "auto" }}>Modifié {new Date(active.updatedAt).toLocaleString("fr-FR")}</span>
            </div>

            {/* Content */}
            <textarea
              value={active.content}
              onChange={e => updateNote(active.id, { content: e.target.value })}
              placeholder="Écrivez votre note ici..."
              readOnly={String(active.owner) !== String(me)}
              style={{ flex: 1, minHeight: 300, padding: 14, borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", lineHeight: 1.7, boxSizing: "border-box", background: String(active.owner) !== String(me) ? "#F4F2EF" : "#fff" }}
            />

            {/* Actions */}
            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              <Btn onClick={() => exportPdf(active)} small outline>📄 Exporter PDF</Btn>
              <Btn onClick={() => copyNote(active)} small outline>📋 Copier le texte</Btn>
              {String(active.owner) === String(me) && <Btn onClick={() => delNote(active.id)} small outline color="#EF4444">🗑️ Supprimer</Btn>}
            </div>

            {/* Sharing */}
            {String(active.owner) === String(me) && (
              <div style={{ marginTop: 14, padding: 12, background: "#F4F2EF", borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>👥 Partager avec</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {users.filter(u => String(u.id) !== String(me)).map(u => (
                    <button key={u.id} onClick={() => toggleShare(active.id, u.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${active.sharedWith.includes(u.id) ? "#0F56B8" : "#E2E8F0"}`, background: active.sharedWith.includes(u.id) ? "#0F56B810" : "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                      <Avatar name={`${u.firstName} ${u.lastName}`} size={20} color={["#6366F1","#EC4899","#10B981","#F59E0B"][u.id % 4]} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: active.sharedWith.includes(u.id) ? "#0F56B8" : "#6B7280" }}>{u.firstName}</span>
                      {active.sharedWith.includes(u.id) && <span style={{ fontSize: 10, color: "#0F56B8" }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {String(active.owner) !== String(me) && (
              <div style={{ marginTop: 10, fontSize: 11, color: "#94A3B8", fontStyle: "italic" }}>📝 Note partagée par {users.find(u => String(u.id) === String(active.owner))?.firstName || "?"} — lecture seule</div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

// ==================== E-LEARNING ====================
function ElearningPage({ elearning, setElearning, users, currentUserId, isAdmin, notifyUser }) {
  const [activeModule, setActiveModule] = useState(null);
  const [activeLesson, setActiveLesson] = useState(0);
  const [quizMode, setQuizMode] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [tab, setTab] = useState("modules");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", icon: "📚", category: "Général", duration: "15 min", description: "", lessons: [{ title: "Leçon 1", content: "", keyPoints: [""] }], quiz: [{ q: "", options: ["", "", "", ""], correct: 0 }] });

  const modules = elearning || [];

  // CRUD
  const saveModule = () => {
    if (!form.title) return;
    const clean = { ...form, lessons: form.lessons.filter(l => l.title), quiz: form.quiz.filter(q => q.q) };
    if (editing) {
      setElearning(p => (p || []).map(m => String(m.id) === String(editing) ? { ...m, ...clean } : m));
    } else {
      setElearning(p => [...(p || []), { id: uid(), ...clean, scores: {} }]);
      // Notify all users about new e-learning module
      users.filter(u => String(u.id) !== String(currentUserId)).forEach(u => { notifyUser(u.id, { title: `📚 Nouveau module e-learning : ${clean.title}`, icon: "📚", badges: ["E-Learning"], target: "elearning" }, "E_LEARNING"); });
    }
    setModal(false); setEditing(null); setForm({ title: "", icon: "📚", category: "Général", duration: "15 min", description: "", lessons: [{ title: "Leçon 1", content: "", keyPoints: [""] }], quiz: [{ q: "", options: ["", "", "", ""], correct: 0 }] });
  };
  const delModule = (id) => { if (!window.confirm("Supprimer ce module ?")) return; setElearning(p => (p || []).filter(m => String(m.id) !== String(id))); if (activeModule === id) setActiveModule(null); };
  const openEdit = (m) => { setEditing(m.id); setForm({ title: m.title, icon: m.icon || "📚", category: m.category || "Général", duration: m.duration || "15 min", description: m.description || "", lessons: m.lessons || [{ title: "", content: "", keyPoints: [""] }], quiz: m.quiz || [{ q: "", options: ["", "", "", ""], correct: 0 }] }); setModal(true); };

  // Quiz
  const submitQuiz = (mod) => {
    const score = (mod.quiz || []).reduce((acc, q, i) => acc + (quizAnswers[i] === q.correct ? 1 : 0), 0);
    const total = (mod.quiz || []).length;
    setElearning(p => (p || []).map(m => String(m.id) === String(mod.id) ? { ...m, scores: { ...(m.scores || {}), [currentUserId]: { score, total, date: new Date().toISOString() } } } : m));
    setQuizSubmitted(true);
  };

  // Active module
  const mod = activeModule ? modules.find(m => String(m.id) === String(activeModule)) : null;

  // MODULE VIEW (lessons + quiz)
  if (mod) {
    const lesson = (mod.lessons || [])[activeLesson];
    if (quizMode) {
      const score = quizSubmitted ? (mod.quiz || []).reduce((acc, q, i) => acc + (quizAnswers[i] === q.correct ? 1 : 0), 0) : 0;
      return (<div>
        <button onClick={() => { setQuizMode(false); setActiveModule(null); setActiveLesson(0); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6B7280", marginBottom: 12, fontFamily: "inherit" }}>← Retour aux modules</button>
        <Card style={{ padding: 24, maxWidth: 700 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>🎯 Quiz — {mod.title}</h2>
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 20 }}>{(mod.quiz || []).length} questions</div>
          {quizSubmitted && <div style={{ padding: "12px 16px", borderRadius: 10, background: score >= (mod.quiz || []).length * 0.7 ? "#10B98115" : "#F59E0B15", border: `1.5px solid ${score >= (mod.quiz || []).length * 0.7 ? "#10B981" : "#F59E0B"}`, marginBottom: 20, textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: score >= (mod.quiz || []).length * 0.7 ? "#10B981" : "#F59E0B" }}>{score}/{(mod.quiz || []).length}</div><div style={{ fontSize: 12, color: "#6B7280" }}>{score >= (mod.quiz || []).length * 0.7 ? "✅ Réussi !" : "⚠️ À retravailler"}</div></div>}
          {(mod.quiz || []).map((q, qi) => (
            <div key={qi} style={{ marginBottom: 16, padding: 14, background: "#F4F2EF", borderRadius: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#2D2D30", marginBottom: 8 }}>{qi + 1}. {q.q}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {q.options.map((opt, oi) => {
                  const selected = quizAnswers[qi] === oi;
                  const isCorrect = quizSubmitted && oi === q.correct;
                  const isWrong = quizSubmitted && selected && oi !== q.correct;
                  return (<button key={oi} onClick={() => { if (!quizSubmitted) setQuizAnswers(p => ({ ...p, [qi]: oi })); }} style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${isCorrect ? "#10B981" : isWrong ? "#EF4444" : selected ? "#0F56B8" : "#E2E8F0"}`, background: isCorrect ? "#10B98115" : isWrong ? "#EF444415" : selected ? "#0F56B810" : "#fff", color: isCorrect ? "#10B981" : isWrong ? "#EF4444" : "#2D2D30", fontSize: 12, fontWeight: selected ? 600 : 400, cursor: quizSubmitted ? "default" : "pointer", textAlign: "left", fontFamily: "inherit" }}>{opt} {isCorrect && "✓"} {isWrong && "✗"}</button>);
                })}
              </div>
            </div>
          ))}
          {!quizSubmitted ? <Btn onClick={() => submitQuiz(mod)} disabled={Object.keys(quizAnswers).length < (mod.quiz || []).length}>Valider le quiz</Btn> : <Btn onClick={() => { setQuizMode(false); setActiveModule(null); setActiveLesson(0); setQuizAnswers({}); setQuizSubmitted(false); }}>Retour aux modules</Btn>}
        </Card>
      </div>);
    }
    return (<div>
      <button onClick={() => { setActiveModule(null); setActiveLesson(0); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6B7280", marginBottom: 12, fontFamily: "inherit" }}>← Retour aux modules</button>
      <Card style={{ padding: 24, maxWidth: 700 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 28 }}>{mod.icon || "📚"}</span>
          <div><h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{mod.title}</h2><div style={{ fontSize: 11, color: "#6B7280" }}>{mod.category} · {mod.duration} · Leçon {activeLesson + 1}/{(mod.lessons || []).length}</div></div>
        </div>
        {lesson && (<>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F56B8", marginBottom: 8 }}>{lesson.title}</h3>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: "#2D2D30", whiteSpace: "pre-wrap", marginBottom: 16 }}>{(lesson.content || "").replace(/\*\*(.*?)\*\*/g, "$1")}</div>
          {lesson.keyPoints && lesson.keyPoints.length > 0 && (<div style={{ background: "#0F56B808", border: "1px solid #0F56B815", borderRadius: 10, padding: 14, marginBottom: 16 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#0F56B8", marginBottom: 6 }}>📌 Points clés</div>{lesson.keyPoints.filter(Boolean).map((kp, i) => <div key={i} style={{ fontSize: 12, color: "#2D2D30", padding: "3px 0" }}>• {kp}</div>)}</div>)}
        </>)}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {activeLesson > 0 && <Btn outline onClick={() => setActiveLesson(p => p - 1)}>← Précédent</Btn>}
          {activeLesson < (mod.lessons || []).length - 1 ? <Btn onClick={() => setActiveLesson(p => p + 1)}>Suivant →</Btn> : <Btn color="#10B981" onClick={() => { setQuizMode(true); setQuizAnswers({}); setQuizSubmitted(false); }}>🎯 Passer le quiz</Btn>}
        </div>
      </Card>
    </div>);
  }

  // DASHBOARD
  const totalModules = modules.length;
  const completedModules = modules.filter(m => m.scores?.[currentUserId]).length;

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
      <div><h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>📚 E-Learning</h2><div style={{ fontSize: 12, color: "#6B7280" }}>Formation & suivi de compétences</div></div>
      {isAdmin && <Btn onClick={() => { setEditing(null); setForm({ title: "", icon: "📚", category: "Général", duration: "15 min", description: "", lessons: [{ title: "Leçon 1", content: "", keyPoints: [""] }], quiz: [{ q: "", options: ["", "", "", ""], correct: 0 }] }); setModal(true); }}>+ Nouveau module</Btn>}
    </div>

    {/* Tabs */}
    <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
      {[{ id: "modules", label: "📚 Modules" }, { id: "progress", label: "📊 Progression" }, ...(isAdmin ? [{ id: "scores", label: "🏆 Scores équipe" }] : [])].map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: tab === t.id ? "#0F56B8" : "#F1F5F9", color: tab === t.id ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t.label}</button>
      ))}
    </div>

    {/* Modules tab */}
    {tab === "modules" && (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {modules.length === 0 ? <Card style={{ padding: 30, textAlign: "center", gridColumn: "1/-1" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📚</div><div style={{ fontSize: 13, color: "#6B7280" }}>Aucun module. {isAdmin ? "Créez-en un !" : ""}</div></Card> : modules.map(m => {
          const myScore = m.scores?.[currentUserId];
          const pct = myScore ? Math.round((myScore.score / myScore.total) * 100) : 0;
          return (
            <Card key={m.id} style={{ cursor: "pointer", overflow: "hidden" }} onClick={() => { setActiveModule(m.id); setActiveLesson(0); }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 28 }}>{m.icon || "📚"}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30" }}>{m.title}</div>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{m.category} · {m.duration} · {(m.lessons || []).length} leçons</div>
                  </div>
                </div>
                {isAdmin && <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEdit(m)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>✏️</button>
                  <button onClick={() => delModule(m.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#EF4444" }}>🗑️</button>
                </div>}
              </div>
              {m.description && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>{m.description}</div>}
              <div style={{ marginTop: 10 }}>
                {myScore ? (<div style={{ display: "flex", alignItems: "center", gap: 8 }}><ProgressBar value={myScore.score} max={myScore.total} height={6} /><span style={{ fontSize: 11, fontWeight: 700, color: pct >= 70 ? "#10B981" : "#F59E0B" }}>{pct}%</span></div>) : (<div style={{ fontSize: 10, color: "#CBD5E1" }}>Non commencé</div>)}
              </div>
            </Card>
          );
        })}
      </div>
    )}

    {/* Progress tab */}
    {tab === "progress" && (
      <Card style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#0F56B815", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#0F56B8" }}>{totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0}%</span>
          </div>
          <div><div style={{ fontSize: 16, fontWeight: 700, color: "#2D2D30" }}>{completedModules}/{totalModules} modules complétés</div><div style={{ fontSize: 12, color: "#6B7280" }}>Continuez à apprendre !</div></div>
        </div>
        {modules.map(m => {
          const myScore = m.scores?.[currentUserId];
          return (<div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #F1F5F9" }}>
            <span style={{ fontSize: 18 }}>{m.icon || "📚"}</span>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#2D2D30" }}>{m.title}</div></div>
            {myScore ? <span style={{ fontSize: 12, fontWeight: 700, color: myScore.score >= myScore.total * 0.7 ? "#10B981" : "#F59E0B" }}>{myScore.score}/{myScore.total}</span> : <span style={{ fontSize: 11, color: "#CBD5E1" }}>—</span>}
          </div>);
        })}
      </Card>
    )}

    {/* Admin: Scores tab */}
    {tab === "scores" && isAdmin && (
      <Card style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>🏆 Scores de l'équipe</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ borderBottom: "2px solid #E2E8F0" }}>
              <th style={{ textAlign: "left", padding: "8px 6px", color: "#6B7280", fontWeight: 600 }}>Module</th>
              {users.map(u => <th key={u.id} style={{ textAlign: "center", padding: "8px 6px", color: "#6B7280", fontWeight: 600 }}>{u.firstName}</th>)}
            </tr></thead>
            <tbody>{modules.map(m => (
              <tr key={m.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "8px 6px", fontWeight: 600, color: "#2D2D30" }}>{m.icon} {m.title}</td>
                {users.map(u => {
                  const s = m.scores?.[u.id];
                  return <td key={u.id} style={{ textAlign: "center", padding: "8px 6px" }}>{s ? <span style={{ fontWeight: 700, color: s.score >= s.total * 0.7 ? "#10B981" : "#F59E0B" }}>{s.score}/{s.total}</span> : <span style={{ color: "#CBD5E1" }}>—</span>}</td>;
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    )}

    {/* Module editor modal */}
    {isAdmin && <Modal open={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? "Modifier le module" : "Nouveau module"} wide>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>Icône</label><input value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} style={{ width: 40, padding: "6px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 18, textAlign: "center" }} /></div>
        <Input label="Titre" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} />
        <Input label="Catégorie" value={form.category} onChange={v => setForm(p => ({ ...p, category: v }))} />
        <Input label="Durée" value={form.duration} onChange={v => setForm(p => ({ ...p, duration: v }))} />
      </div>
      <Textarea label="Description" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} rows={2} />

      {/* Lessons */}
      <div style={{ marginTop: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30" }}>📖 Leçons ({form.lessons.length})</label>
          <button onClick={() => setForm(p => ({ ...p, lessons: [...p.lessons, { title: "", content: "", keyPoints: [""] }] }))} style={{ background: "#0F56B8", color: "#fff", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Leçon</button>
        </div>
        {form.lessons.map((lesson, li) => (
          <div key={li} style={{ background: "#F4F2EF", borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>Leçon {li + 1}</span>
              {form.lessons.length > 1 && <button onClick={() => setForm(p => ({ ...p, lessons: p.lessons.filter((_, i) => i !== li) }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#EF4444" }}>✕</button>}
            </div>
            <input value={lesson.title} onChange={e => setForm(p => ({ ...p, lessons: p.lessons.map((l, i) => i === li ? { ...l, title: e.target.value } : l) }))} placeholder="Titre de la leçon" style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", marginBottom: 4, boxSizing: "border-box" }} />
            <textarea value={lesson.content} onChange={e => setForm(p => ({ ...p, lessons: p.lessons.map((l, i) => i === li ? { ...l, content: e.target.value } : l) }))} placeholder="Contenu (utilisez **gras** pour mettre en valeur)" rows={3} style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", resize: "vertical", marginBottom: 4, boxSizing: "border-box" }} />
            <input value={(lesson.keyPoints || []).join(", ")} onChange={e => setForm(p => ({ ...p, lessons: p.lessons.map((l, i) => i === li ? { ...l, keyPoints: e.target.value.split(",").map(s => s.trim()) } : l) }))} placeholder="Points clés (séparés par des virgules)" style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 11, fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
        ))}
      </div>

      {/* Quiz */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30" }}>🎯 Quiz ({form.quiz.length} questions)</label>
          <button onClick={() => setForm(p => ({ ...p, quiz: [...p.quiz, { q: "", options: ["", "", "", ""], correct: 0 }] }))} style={{ background: "#10B981", color: "#fff", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Question</button>
        </div>
        {form.quiz.map((q, qi) => (
          <div key={qi} style={{ background: "#F4F2EF", borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>Q{qi + 1}</span>
              {form.quiz.length > 1 && <button onClick={() => setForm(p => ({ ...p, quiz: p.quiz.filter((_, i) => i !== qi) }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#EF4444" }}>✕</button>}
            </div>
            <input value={q.q} onChange={e => setForm(p => ({ ...p, quiz: p.quiz.map((x, i) => i === qi ? { ...x, q: e.target.value } : x) }))} placeholder="Question" style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", marginBottom: 4, boxSizing: "border-box" }} />
            {q.options.map((opt, oi) => (
              <div key={oi} style={{ display: "flex", gap: 4, marginBottom: 2, alignItems: "center" }}>
                <button onClick={() => setForm(p => ({ ...p, quiz: p.quiz.map((x, i) => i === qi ? { ...x, correct: oi } : x) }))} style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${q.correct === oi ? "#10B981" : "#E2E8F0"}`, background: q.correct === oi ? "#10B981" : "#fff", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10 }}>{q.correct === oi && "✓"}</button>
                <input value={opt} onChange={e => setForm(p => ({ ...p, quiz: p.quiz.map((x, i) => i === qi ? { ...x, options: x.options.map((o, j) => j === oi ? e.target.value : o) } : x) }))} placeholder={`Réponse ${oi + 1}`} style={{ flex: 1, padding: "4px 8px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }} />
              </div>
            ))}
            <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 4 }}>Cliquez le cercle vert pour marquer la bonne réponse</div>
          </div>
        ))}
      </div>
      <Btn onClick={saveModule}>Enregistrer</Btn>
    </Modal>}
  </div>);
}

// ==================== HASHTAGS ====================
function HashtagsPage({ hashtags, setHashtags, clubs, currentUserId, isAdmin, currentUser }) {
  const myClubs = isAdmin ? clubs : clubs.filter(c => (currentUser?.clubs || []).some(uc => String(uc) === String(c.id)));
  const [form, setForm] = useState({ club: myClubs[0]?.id || 1, theme: "", tags: "" });
  const [editId, setEditId] = useState(null);
  const add = () => { if (!form.theme) return; if (editId) { setHashtags(p => p.map(h => String(h.id) === String(editId) ? { ...h, ...form, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean) } : h)); setEditId(null); } else { setHashtags(p => [...p, { id: uid(), ...form, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean) }]); } setForm({ club: myClubs[0]?.id || 1, theme: "", tags: "" }); };
  const del = (id) => setHashtags(p => p.filter(h => String(h.id) !== String(id)));
  const edit = (h) => { setEditId(h.id); setForm({ club: h.club, theme: h.theme, tags: h.tags.join(", ") }); };
  const copy = (tags) => navigator.clipboard.writeText(tags.join(" ")).catch(() => {});
  return (<div>
    <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>#️⃣ Bibliothèque de hashtags</h2>
    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>Organisez vos hashtags par club et thème · Cliquez pour copier</div>
    <Card style={{ padding: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <Select label="Club" value={form.club} onChange={v => setForm(p => ({ ...p, club: v }))} options={myClubs.map(c => ({ value: String(c.id), label: c.name }))} />
        <Input label="Thème" value={form.theme} onChange={v => setForm(p => ({ ...p, theme: v }))} placeholder="Ex: Tournoi" />
        <Input label="Hashtags (séparés par ,)" value={form.tags} onChange={v => setForm(p => ({ ...p, tags: v }))} placeholder="#padel, #tournoi" />
        <Btn onClick={add} small>{editId ? "✓ Modifier" : "+ Ajouter"}</Btn>
      </div>
    </Card>
    {myClubs.map(c => { const ch = hashtags.filter(h => h.club === c.id); if (!ch.length) return null; return (<div key={c.id} style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: c.color }} /><span style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30" }}>{c.name}</span></div>
      {ch.map(h => (<Card key={h.id} style={{ padding: 12, marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Badge text={h.theme} color={c.color} /><div style={{ display: "flex", gap: 4 }}><button onClick={() => copy(h.tags)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#0F56B8", fontWeight: 600, fontFamily: "inherit" }}>📋 Copier</button><button onClick={() => edit(h)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#6B7280", fontFamily: "inherit" }}>✏️</button><button onClick={() => del(h.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#EF4444", fontFamily: "inherit" }}>🗑️</button></div>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{h.tags.map((t, i) => <span key={i} style={{ padding: "3px 10px", borderRadius: 14, background: c.color + "12", color: c.color, fontSize: 11, fontWeight: 600 }}>{t}</span>)}</div>
      </Card>))}
    </div>); })}
  </div>);
}

// ==================== TEMPLATES (Pinterest-like gallery + Canva preview) ====================
function CanvaPreview({ url, thumbnail, height = 200 }) {
  const [iframeFailed, setIframeFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    setIframeFailed(false);
    setLoaded(false);
    if (!url || thumbnail) return; // skip iframe attempt if a manual thumbnail exists
    // If the iframe hasn't reported loaded within 3.5s, assume Canva blocked it (X-Frame-Options)
    timeoutRef.current = setTimeout(() => { if (!loaded) setIframeFailed(true); }, 3500);
    return () => clearTimeout(timeoutRef.current);
  }, [url, thumbnail]);

  if (thumbnail) {
    return <img src={thumbnail} alt="Aperçu du design" style={{ width: "100%", height, objectFit: "cover", display: "block" }} />;
  }
  if (!url) {
    return <div style={{ width: "100%", height, background: "linear-gradient(135deg,#F4F2EF,#E2E8F0)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6 }}><span style={{ fontSize: 32 }}>🎨</span><span style={{ fontSize: 10, color: "#94A3B8" }}>Aucun aperçu</span></div>;
  }
  if (iframeFailed) {
    return (
      <a href={url} target="_blank" rel="noreferrer" style={{ width: "100%", height, background: "linear-gradient(135deg,#00C4CC15,#7D2AE815)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, textDecoration: "none" }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: "#00C4CC" }}>C</span>
        <span style={{ fontSize: 11, color: "#00C4CC", fontWeight: 700 }}>Aperçu non disponible</span>
        <span style={{ fontSize: 9, color: "#94A3B8" }}>↗ Cliquer pour ouvrir sur Canva</span>
      </a>
    );
  }
  return (
    <div style={{ width: "100%", height, position: "relative", background: "#FAFBFC", overflow: "hidden" }}>
      {!loaded && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#CBD5E1", fontSize: 11 }}>Chargement de l'aperçu...</div>}
      <iframe
        src={url}
        title="Aperçu Canva"
        onLoad={() => { setLoaded(true); clearTimeout(timeoutRef.current); }}
        onError={() => setIframeFailed(true)}
        style={{ width: "100%", height: "100%", border: "none", opacity: loaded ? 1 : 0, transition: "opacity .3s", pointerEvents: "none" }}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}

function TemplatesPage({ templates, setTemplates, currentUserId, isAdmin, templateCategories, setTemplateCategories, isMobile, isTablet }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ type: "post", name: "", content: "", canvaUrl: "", thumbnail: "" });
  const [active, setActive] = useState(null);
  const [filter, setFilter] = useState(null);
  const [newCat, setNewCat] = useState("");
  const [thumbUploading, setThumbUploading] = useState(false);
  const defaultCats = [{ id: "post", icon: "📱", label: "Post", color: "#0F56B8" }, { id: "story", icon: "📸", label: "Story", color: "#EC4899" }, { id: "whatsapp", icon: "💬", label: "WhatsApp", color: "#25D366" }, { id: "push", icon: "🔔", label: "Push", color: "#FB8500" }];
  const allCats = [...defaultCats, ...(templateCategories || [])];
  const save = () => { if (!form.name) return; if (editing) { setTemplates(p => p.map(t => String(t.id) === String(editing) ? { ...t, ...form } : t)); } else { setTemplates(p => [...p, { id: uid(), ...form, owner: currentUserId }]); } setModal(false); setEditing(null); setForm({ type: "post", name: "", content: "", canvaUrl: "", thumbnail: "" }); };
  const openEdit = (t) => { setEditing(t.id); setForm({ type: t.type, name: t.name, content: t.content, canvaUrl: t.canvaUrl || "", thumbnail: t.thumbnail || "" }); setModal(true); };
  const del = (id) => { if (!isAdmin) return; setTemplates(p => p.filter(t => String(t.id) !== String(id))); if (active === id) setActive(null); };
  const copy = (content) => navigator.clipboard.writeText(content).catch(() => {});
  const [newCatEmoji, setNewCatEmoji] = useState("📄");
  const emojiList = ["📄","📱","📸","💬","🔔","📊","🎯","🏆","📋","✨","🎨","📝","🎬","💡","🔗","📌","🗂️","📢","🖼️","⭐"];
  const addCat = () => { if (!newCat.trim() || !isAdmin) return; setTemplateCategories(p => [...(p || []), { id: newCat.toLowerCase().replace(/\s+/g, "_"), icon: newCatEmoji, label: newCat, color: "#6B7280" }]); setNewCat(""); setNewCatEmoji("📄"); };
  const delCat = (catId) => { if (!isAdmin) return; setTemplateCategories(p => (p || []).filter(c => String(c.id) !== String(catId))); };
  const filtered = filter ? templates.filter(t => t.type === filter) : templates;
  const act = active ? templates.find(t => String(t.id) === String(active)) : null;
  const getCat = (type) => allCats.find(c => String(c.id) === String(type)) || { icon: "📄", label: type, color: "#6B7280" };

  // Varying heights for Pinterest masonry effect (based on index parity)
  const getCardHeight = (i) => [180, 220, 160, 240, 190][i % 5];

  const handleThumbUpload = async (file) => {
    if (!file) return;
    setThumbUploading(true);
    const reader = new FileReader();
    reader.onload = () => { setForm(p => ({ ...p, thumbnail: reader.result })); setThumbUploading(false); };
    reader.onerror = () => { setThumbUploading(false); };
    reader.readAsDataURL(file);
  };

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
      <div><h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>🎨 Templates</h2><div style={{ fontSize: 12, color: "#6B7280" }}>Galerie de modèles Canva — cliquez pour ouvrir et dupliquer</div></div>
      {isAdmin && <Btn onClick={() => { setEditing(null); setForm({ type: "post", name: "", content: "", canvaUrl: "", thumbnail: "" }); setModal(true); }}>+ Nouveau template</Btn>}
    </div>
    <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
      <button onClick={() => setFilter(null)} style={{ padding: "4px 12px", borderRadius: 14, border: `1.5px solid ${!filter ? "#0F56B8" : "#E2E8F0"}`, background: !filter ? "#0F56B810" : "transparent", color: !filter ? "#0F56B8" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Tous ({templates.length})</button>
      {allCats.map(v => { const count = templates.filter(t => t.type === v.id).length; return (
        <button key={v.id} onClick={() => setFilter(filter === v.id ? null : v.id)} style={{ padding: "4px 12px", borderRadius: 14, border: `1.5px solid ${filter === v.id ? v.color : "#E2E8F0"}`, background: filter === v.id ? v.color + "10" : "transparent", color: filter === v.id ? v.color : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", position: "relative" }}>{v.icon} {v.label} ({count}){isAdmin && !defaultCats.find(d => String(d.id) === String(v.id)) && <span onClick={e => { e.stopPropagation(); delCat(v.id); }} style={{ marginLeft: 4, color: "#EF4444", fontSize: 9 }}>✕</span>}</button>
      ); })}
      {isAdmin && (<div style={{ display: "flex", gap: 4, marginLeft: 8, alignItems: "center" }}><select value={newCatEmoji} onChange={e => setNewCatEmoji(e.target.value)} style={{ padding: "2px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 14, width: 36 }}>{emojiList.map(em => <option key={em} value={em}>{em}</option>)}</select><input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nouvelle catégorie..." style={{ padding: "3px 8px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 10, fontFamily: "inherit", outline: "none", width: 110 }} /><button onClick={addCat} style={{ padding: "3px 8px", borderRadius: 8, border: "none", background: "#0F56B8", color: "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+</button></div>)}
    </div>

    {/* Pinterest-style masonry grid */}
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : isTablet ? "repeat(3, 1fr)" : "repeat(4, 1fr)", gap: 14, alignItems: "start" }}>
      {filtered.map((t, i) => { const tp = getCat(t.type); return (
        <Card key={t.id} onClick={() => setActive(t.id)} style={{ padding: 0, cursor: "pointer", overflow: "hidden", border: active === t.id ? `2px solid ${tp.color}` : "1px solid #F1F5F9", transition: "transform .15s, box-shadow .15s" }}>
          <div style={{ position: "relative" }}>
            <CanvaPreview url={t.canvaUrl} thumbnail={t.thumbnail} height={getCardHeight(i)} />
            <div style={{ position: "absolute", top: 8, left: 8 }}><Badge text={`${tp.icon} ${tp.label}`} color={tp.color} /></div>
            {isAdmin && (
              <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 3 }}>
                <button onClick={e => { e.stopPropagation(); openEdit(t); }} style={{ width: 24, height: 24, borderRadius: 8, border: "none", background: "rgba(255,255,255,.92)", cursor: "pointer", fontSize: 11, boxShadow: "0 1px 4px rgba(0,0,0,.15)" }}>✏️</button>
                <button onClick={e => { e.stopPropagation(); del(t.id); }} style={{ width: 24, height: 24, borderRadius: 8, border: "none", background: "rgba(255,255,255,.92)", cursor: "pointer", fontSize: 11, color: "#EF4444", boxShadow: "0 1px 4px rgba(0,0,0,.15)" }}>🗑️</button>
              </div>
            )}
            {t.canvaUrl && (
              <div style={{ position: "absolute", bottom: 8, right: 8, width: 22, height: 22, borderRadius: 6, background: "#00C4CC", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,.2)" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>C</span>
              </div>
            )}
          </div>
          <div style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
            {t.content && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.content.slice(0, 50)}</div>}
          </div>
        </Card>
      ); })}
      {filtered.length === 0 && <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 12 }}><div style={{ fontSize: 32, marginBottom: 8 }}>🎨</div>Aucun template</div>}
    </div>

    {/* Detail overlay/modal when a template is active */}
    {act && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setActive(null)}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "min(720px, 95vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.3)" }}>
          <div style={{ position: "relative" }}>
            <CanvaPreview url={act.canvaUrl} thumbnail={act.thumbnail} height={isMobile ? 220 : 320} />
            <button onClick={() => setActive(null)} style={{ position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.95)", cursor: "pointer", fontSize: 16, boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}>✕</button>
          </div>
          <div style={{ padding: 22 }}>
            <Badge text={`${getCat(act.type).icon} ${getCat(act.type).label}`} color={getCat(act.type).color} />
            <div style={{ fontSize: 19, fontWeight: 700, color: "#2D2D30", marginTop: 10, marginBottom: 14 }}>{act.name}</div>

            {act.canvaUrl && (
              <a href={act.canvaUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, background: "#00C4CC10", border: "1.5px solid #00C4CC40", textDecoration: "none", marginBottom: 14 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#00C4CC" }}>C</span>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#00C4CC" }}>Ouvrir dans Canva</div><div style={{ fontSize: 10, color: "#6B7280" }}>Dupliquez ce template et personnalisez-le</div></div>
                <span style={{ fontSize: 14, color: "#00C4CC" }}>↗</span>
              </a>
            )}
            {act.content && (<>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>Contenu / notes :</div>
              <pre style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap", background: "#F4F2EF", padding: 14, borderRadius: 10, color: "#2D2D30", fontFamily: "'Montserrat', sans-serif", margin: 0 }}>{act.content}</pre>
            </>)}
            <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
              {act.content && <Btn onClick={() => copy(act.content)} small outline>📋 Copier le texte</Btn>}
              {act.canvaUrl && <Btn onClick={() => copy(act.canvaUrl)} small outline>🔗 Copier le lien</Btn>}
            </div>
          </div>
        </div>
      </div>
    )}

    {isAdmin && <Modal open={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? "Modifier le template" : "Nouveau template"}>
      <Select label="Type" value={form.type} onChange={v => setForm(p => ({ ...p, type: v }))} options={allCats.map(c => ({ value: c.id, label: `${c.icon} ${c.label}` }))} />
      <Input label="Nom du template" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Ex: Post annonce tournoi" />
      <Input label="🔗 Lien Canva (URL du design à dupliquer)" value={form.canvaUrl} onChange={v => setForm(p => ({ ...p, canvaUrl: v }))} placeholder="https://www.canva.com/design/..." />

      <div style={{ marginBottom: 14, padding: 14, background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0" }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#2D2D30", marginBottom: 4 }}>🖼️ Visuel du template</label>
        <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 10, lineHeight: 1.5 }}>Canva bloque l'aperçu en direct dans l'app. Pour avoir un visuel fiable :<br/>1️⃣ Ouvrez votre design et exportez-le en image (PNG/JPG)<br/>2️⃣ Glissez le fichier téléchargé ci-dessous, ou collez-le (Cmd/Ctrl+V)</div>

        {form.canvaUrl && (
          <a href={form.canvaUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "#00C4CC10", border: "1.5px solid #00C4CC40", textDecoration: "none", marginBottom: 10, fontSize: 11, fontWeight: 700, color: "#00C4CC" }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>C</span> Ouvrir le design sur Canva pour l'exporter ↗
          </a>
        )}

        <div
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#0F56B8"; e.currentTarget.style.background = "#0F56B808"; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = form.thumbnail ? "transparent" : "#fff"; }}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#E2E8F0"; const f = e.dataTransfer.files?.[0]; if (f && f.type.startsWith("image/")) handleThumbUpload(f); }}
          onPaste={e => { const item = [...e.clipboardData.items].find(i => i.type.startsWith("image/")); if (item) handleThumbUpload(item.getAsFile()); }}
          tabIndex={0}
          style={{ border: `2px dashed ${form.thumbnail ? "transparent" : "#E2E8F0"}`, borderRadius: 12, padding: form.thumbnail ? 0 : 24, textAlign: "center", background: "#fff", outline: "none", transition: "all .15s" }}
        >
          {form.thumbnail ? (
            <div style={{ position: "relative", display: "inline-block" }}>
              <img src={form.thumbnail} alt="visuel" style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 10, border: "1px solid #E2E8F0", display: "block" }} />
              <button onClick={() => setForm(p => ({ ...p, thumbnail: "" }))} style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: "50%", background: "#EF4444", color: "#fff", border: "2px solid #fff", fontSize: 12, cursor: "pointer", lineHeight: "20px", boxShadow: "0 2px 6px rgba(0,0,0,.2)" }}>✕</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 30, marginBottom: 6 }}>{thumbUploading ? "⏳" : "🖼️"}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 2 }}>{thumbUploading ? "Chargement..." : "Glissez l'image ici ou collez-la (Cmd/Ctrl+V)"}</div>
              <div style={{ fontSize: 10, color: "#CBD5E1", marginBottom: 10 }}>ou</div>
            </>
          )}
          {!form.thumbnail && (
            <label style={{ display: "inline-block", padding: "8px 16px", borderRadius: 8, border: "1.5px solid #E2E8F0", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#0F56B8", fontFamily: "inherit", background: "#fff" }}>
              📁 Choisir un fichier
              <input type="file" accept="image/*" onChange={e => handleThumbUpload(e.target.files?.[0])} style={{ display: "none" }} />
            </label>
          )}
          {form.thumbnail && (
            <label style={{ display: "block", marginTop: 8, fontSize: 10, fontWeight: 600, color: "#0F56B8", cursor: "pointer", fontFamily: "inherit" }}>
              🔄 Remplacer l'image
              <input type="file" accept="image/*" onChange={e => handleThumbUpload(e.target.files?.[0])} style={{ display: "none" }} />
            </label>
          )}
        </div>
      </div>

      <Textarea label="Contenu / notes" value={form.content} onChange={v => setForm(p => ({ ...p, content: v }))} rows={6} />
      <Btn onClick={save}>{editing ? "Enregistrer" : "Créer le template"}</Btn>
    </Modal>}
  </div>);
}

// ==================== BRIEFS CREATIFS ====================
function BriefsPage({ briefs, setBriefs, clubs, users, currentUserId }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: "", club: clubs[0]?.id || 1, assignee: "", deadline: "", description: "", specs: "", status: "À faire" });
  const save = () => { if (!form.title) return; setBriefs(p => [...p, { id: uid(), ...form, owner: currentUserId }]); setModal(false); };
  const del = (id) => setBriefs(p => p.filter(b => String(b.id) !== String(id)));
  const updateStatus = (id, st) => setBriefs(p => p.map(b => String(b.id) === String(id) ? { ...b, status: st } : b));
  const stColors = { "À faire": "#EF4444", "En cours": "#FB8500", "En review": "#FEB601", "Terminé": "#10B981" };
  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><div><h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>🎨 Briefs créatifs</h2><div style={{ fontSize: 12, color: "#6B7280" }}>Briefez vos graphistes et prestataires</div></div><Btn onClick={() => setModal(true)}>+ Nouveau brief</Btn></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {briefs.map(b => (<Card key={b.id} style={{ padding: 14, borderLeft: `4px solid ${stColors[b.status] || "#E2E8F0"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30" }}>{b.title}</div><div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{clubs.find(c => String(c.id) === String(b.club))?.name} · {b.assignee} · {b.deadline}</div>{b.description && <div style={{ fontSize: 12, color: "#2D2D30", marginTop: 6, lineHeight: 1.5 }}>{b.description}</div>}{b.specs && <pre style={{ fontSize: 11, color: "#6B7280", marginTop: 6, background: "#F4F2EF", padding: 10, borderRadius: 8, whiteSpace: "pre-wrap", fontFamily: "'Montserrat', sans-serif" }}>{b.specs}</pre>}</div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0, flexDirection: "column", alignItems: "end" }}><Badge text={b.status} color={stColors[b.status]} /><div style={{ display: "flex", gap: 3, marginTop: 4 }}>{Object.keys(stColors).map(s => <button key={s} onClick={() => updateStatus(b.id, s)} style={{ width: 10, height: 10, borderRadius: "50%", background: b.status === s ? stColors[s] : stColors[s] + "30", border: "none", cursor: "pointer" }} title={s} />)}<button onClick={() => del(b.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#EF4444" }}>🗑️</button></div></div>
        </div>
      </Card>))}
    </div>
    <Modal open={modal} onClose={() => setModal(false)} title="Nouveau brief créatif">
      <Input label="Titre" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Select label="Club" value={form.club} onChange={v => setForm(p => ({ ...p, club: v }))} options={clubs.map(c => ({ value: String(c.id), label: c.name }))} /><Input label="Assigné à" value={form.assignee} onChange={v => setForm(p => ({ ...p, assignee: v }))} /></div>
      <Input label="Deadline" value={form.deadline} onChange={v => setForm(p => ({ ...p, deadline: v }))} type="date" />
      <Textarea label="Description du brief" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} />
      <Textarea label="Spécifications techniques" value={form.specs} onChange={v => setForm(p => ({ ...p, specs: v }))} placeholder="Formats, dimensions, couleurs..." />
      <Btn onClick={save}>Créer le brief</Btn>
    </Modal>
  </div>);
}

// ==================== VEILLE ====================
function VeillePage({ veille, setVeille, clubs, currentUserId, isAdmin, notifyUser, users }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ competitor: "", notes: "", link: "", date: new Date().toISOString().split("T")[0] });
  const save = () => { if (!form.competitor) return; if (editing) { setVeille(p => p.map(v => String(v.id) === String(editing) ? { ...v, ...form } : v)); } else { setVeille(p => [...p, { id: uid(), ...form, club: "all", owner: currentUserId }]); users.filter(u => String(u.id) !== String(currentUserId)).forEach(u => { notifyUser(u.id, { title: `🔍 Nouvelle veille : ${form.competitor}`, icon: "🔍", badges: ["Veille"], target: "veille" }, "VEILLE"); }); } setModal(false); setEditing(null); };
  const openEdit = (v) => { setEditing(v.id); setForm({ competitor: v.competitor, notes: v.notes || "", link: v.link || "", date: v.date }); setModal(true); };
  const del = (id) => setVeille(p => p.filter(v => String(v.id) !== String(id)));
  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><div><h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>🔍 Veille concurrentielle</h2><div style={{ fontSize: 12, color: "#6B7280" }}>Suivez ce que font les autres clubs</div></div>{isAdmin && <Btn onClick={() => { setEditing(null); setForm({ competitor: "", notes: "", link: "", date: new Date().toISOString().split("T")[0] }); setModal(true); }}>+ Ajouter une observation</Btn>}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {veille.sort((a, b) => b.date.localeCompare(a.date)).map(v => (<Card key={v.id} style={{ padding: 14, borderLeft: "4px solid #0F56B8" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30" }}>{v.competitor}</div><div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>📅 {v.date} · 🏢 Tous les clubs</div><div style={{ fontSize: 12, color: "#2D2D30", marginTop: 6, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{v.notes}</div>{v.link && <a href={v.link} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, padding: "4px 12px", borderRadius: 8, background: "#0F56B810", color: "#0F56B8", fontSize: 11, fontWeight: 600, textDecoration: "none" }}>🔗 Voir le lien</a>}</div>
          {isAdmin && <div style={{ display: "flex", gap: 4, flexShrink: 0 }}><button onClick={() => openEdit(v)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#6B7280" }}>✏️</button><button onClick={() => del(v.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#EF4444" }}>🗑️</button></div>}
        </div>
      </Card>))}
    </div>
    <Modal open={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? "Modifier l'observation" : "Nouvelle observation"}>
      <Input label="Nom du concurrent" value={form.competitor} onChange={v => setForm(p => ({ ...p, competitor: v }))} placeholder="Ex: Padel City Lyon" />
      <Input label="Date" value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} type="date" />
      <Textarea label="Observations" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} rows={4} placeholder="Qu'ont-ils fait ? Quelles idées à retenir ?" />
      <Input label="Lien (optionnel)" value={form.link} onChange={v => setForm(p => ({ ...p, link: v }))} placeholder="https://instagram.com/..." />
      <Btn onClick={save}>Enregistrer</Btn>
    </Modal>
  </div>);
}

// ==================== CAMPAGNES ====================
function CampagnesPage({ campagnes, setCampagnes, clubs, users, isAdmin, isDirector, currentUser, currentUserId, addToast }) {
  // Exclure le siège (France) des sections KPI et Liens — clubs physiques uniquement
  const physicalClubs = clubs.filter(c => !["France","france","FRANCE","Siège","siege","National"].includes(String(c.name).trim()));
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [mainTab, setMainTab] = useState("list"); // list | suivi
  const [suiviCamp, setSuiviCamp] = useState(null); // selected campaign for suivi
  const [suiviFilter, setSuiviFilter] = useState("all"); // all | late | done
  const [actionModal, setActionModal] = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const [actionForm, setActionForm] = useState({ label: "", deadline: "", clubs: [] });
  const [form, setForm] = useState({
    name: "", dateStart: "", dateEnd: "", persona: "", positioning: "", concept: "", signature: "",
    channels: [], hashtags: "", pushTitle: "", pushMessage: "", whatsappMessage: "", visuels: [], pdfName: "Campagne", published: false,
    channelNotes: {}, links: [], visualsTodo: [],
    // Structured new fields
    objectives: [], // ["Recruter", "Réactiver"...]
    packs: [],      // [{ id, name, items: [] }]
    products: "",   // free text for boutique/products highlight
    carteClub: "",  // Carte Club bonuses description
    abonnements: "", cours: "", coursIndividuel: "",
    whatsappMessages: [], // [{ id, date, time, target, text }]
    notifications: [], // [{ id, date, time, title, body, link }]
    timeline: [{ id: uid(), phase: "Avant", label: "", date: "", done: false }, { id: uid(), phase: "Pendant", label: "", date: "", done: false }, { id: uid(), phase: "Après", label: "", date: "", done: false }]
  });
  const [formTab, setFormTab] = useState("identite"); // identite | objectifs | concept | offre | canaux | planning | kpi
  const [uploading, setUploading] = useState(false);
  const [migrated, setMigrated] = useState(false);

  // Auto-migrate: sync timeline → actions for campaigns that have timeline but empty/missing actions
  useEffect(() => {
    if (!isAdmin || migrated || campagnes.length === 0) return;
    let hasChanges = false;
    const updated = campagnes.map(c => {
      const timeline = (c.timeline || []).filter(t => t.label && t.label.trim());
      const existingActions = c.actions || [];
      // If timeline has items but actions is empty OR missing any timeline item → sync
      const missingActions = timeline.filter(t => !existingActions.some(a => String(a.id) === String(t.id)));
      if (missingActions.length === 0) return c;
      hasChanges = true;
      const syncedActions = timeline.map(t => {
        const existing = existingActions.find(a => String(a.id) === String(t.id));
        return {
          id: t.id,
          label: t.label,
          deadline: t.date || "",
          phase: t.phase,
          clubs: clubs.map(cl => cl.id),
          clubStatus: existing?.clubStatus || {},
          done: t.done || false,
        };
      });
      return { ...c, actions: syncedActions };
    });
    if (hasChanges) setCampagnes(updated);
    setMigrated(true);
  }, [campagnes, isAdmin, clubs]);

  const CHANNELS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "Google Business", "Newsletter", "WhatsApp", "SMS", "Affichage", "Site web"];

  const EMPTY_FORM = () => ({ name: "", dateStart: "", dateEnd: "", persona: "", positioning: "", concept: "", signature: "", channels: [], hashtags: "", pushTitle: "", pushMessage: "", whatsappMessage: "", visuels: [], pdfName: "Campagne", published: false, channelNotes: {}, links: [], visualLinks: [], visualsTodo: [], objectives: [], packs: [], products: "", carteClub: "", abonnements: "", cours: "", coursIndividuel: "", whatsappMessages: [], notifications: [], kpi: [], kpiData: {}, kpiIndicators: [], kpiValues: {}, targets: [], presentation: "", timeline: [{ id: uid(), phase: "Avant", label: "", date: "", done: false }, { id: uid(), phase: "Pendant", label: "", date: "", done: false }, { id: uid(), phase: "Après", label: "", date: "", done: false }] });
  const openNew = () => { setEditing(null); setForm(EMPTY_FORM()); setFormTab("identite"); setModal(true); };
  const openEdit = (c) => { setEditing(c.id); setForm({ ...EMPTY_FORM(), ...c, kpiIndicators: c.kpiIndicators || [], kpiValues: c.kpiValues || {}, kpiData: c.kpiData || {}, timeline: c.timeline || [], whatsappMessages: c.whatsappMessages || [], notifications: c.notifications || [], packs: c.packs || [], links: c.links || [], visualsTodo: c.visualsTodo || [], objectives: c.objectives || [], channels: c.channels || [] }); setFormTab("identite"); setModal(true); };
  const save = () => {
    if (!form.name) return;
    // Sync timeline items → actions for suivi
    const syncedActions = (form.timeline || [])
      .filter(t => t.label)
      .map(t => {
        // Find existing action to preserve clubStatus
        const existingActions = editing ? (campagnes.find(c => String(c.id) === String(editing))?.actions || []) : [];
        const existing = existingActions.find(a => String(a.id) === String(t.id));
        return {
          id: t.id,
          label: t.label,
          deadline: t.date || "",
          phase: t.phase,
          clubs: clubs.map(c => c.id),
          clubStatus: existing?.clubStatus || {},
          done: t.done || false,
        };
      });
    if (editing) setCampagnes(p => p.map(c => String(c.id) === String(editing) ? { ...c, ...form, actions: syncedActions } : c));
    else setCampagnes(p => [...p, { id: uid(), ...form, actions: syncedActions, owner: currentUserId, createdAt: new Date().toISOString() }]);
    setModal(false); addToast({ title: `📢 Campagne ${editing ? "modifiée" : "créée"} : ${form.name}`, icon: "📢" });
  };
  const del = (id) => { if (!window.confirm("Supprimer cette campagne ?")) return; setCampagnes(p => p.filter(c => String(c.id) !== String(id))); };

  // Bonus: check deadlines on mount
  useEffect(() => {
    if (!isAdmin) return;
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    campagnes.forEach(camp => {
      (camp.actions || []).forEach(a => {
        if (!a.deadline) return;
        const allClubs = (a.clubs || []).length > 0 ? a.clubs : clubs.map(c => c.id);
        const pending = allClubs.filter(cid => !(a.clubStatus || {})[cid]);
        if (pending.length > 0 && a.deadline === tomorrowStr) {
          addToast({ title: `⚠️ Deadline demain : "${a.label}" (${camp.name}) — ${pending.length} club(s) en attente`, icon: "⚠️" });
        }
      });
    });
  }, []);

  // Action tracking helpers
  const todayStr = new Date().toISOString().split("T")[0];
  const openNewAction = (campId) => { setEditingAction(null); setActionForm({ label: "", deadline: "", clubs: clubs.map(c => c.id) }); setSuiviCamp(campId); setActionModal(true); };
  const openEditAction = (campId, action) => { setEditingAction(action.id); setActionForm({ label: action.label, deadline: action.deadline, clubs: action.clubs || clubs.map(c => c.id) }); setSuiviCamp(campId); setActionModal(true); };
  const saveAction = () => {
    if (!actionForm.label) return;
    setCampagnes(p => p.map(c => {
      if (String(c.id) !== String(suiviCamp)) return c;
      const actions = c.actions || [];
      if (editingAction) return { ...c, actions: actions.map(a => String(a.id) === String(editingAction) ? { ...a, ...actionForm } : a) };
      return { ...c, actions: [...actions, { id: uid(), ...actionForm, clubStatus: {} }] };
    }));
    setActionModal(false);
  };
  const delAction = (campId, actionId) => setCampagnes(p => p.map(c => String(c.id) === String(campId) ? { ...c, actions: (c.actions || []).filter(a => String(a.id) !== String(actionId)) } : c));
  const toggleClubAction = (campId, actionId, clubId) => {
    setCampagnes(p => p.map(c => {
      if (String(c.id) !== String(campId)) return c;
      const newActions = (c.actions || []).map(a => {
        if (String(a.id) !== String(actionId)) return a;
        const status = a.clubStatus || {};
        const newStatus = { ...status, [clubId]: !status[clubId] };
        // Sync done: true only when ALL clubs are done
        const allClubIds = (a.clubs || []).length > 0 ? a.clubs : clubs.map(cl => cl.id);
        const allDone = allClubIds.every(cid => newStatus[cid]);
        return { ...a, clubStatus: newStatus, done: allDone };
      });
      // Sync done back to timeline
      const newTimeline = (c.timeline || []).map(t => {
        const matchAction = newActions.find(a => String(a.id) === String(t.id));
        return matchAction ? { ...t, done: matchAction.done } : t;
      });
      return { ...c, actions: newActions, timeline: newTimeline };
    }));
  };
  const getActionStatus = (action, clubId) => {
    const done = (action.clubStatus || {})[clubId];
    if (done) return "done";
    if (action.deadline && action.deadline < todayStr) return "late";
    return "pending";
  };
  const getCampProgress = (camp) => {
    const actions = camp.actions || [];
    if (!actions.length) return 0;
    const campClubs = clubs;
    let total = 0; let done = 0;
    actions.forEach(a => {
      const aClubs = (a.clubs || []).length > 0 ? a.clubs : campClubs.map(c => c.id);
      aClubs.forEach(cid => { total++; if ((a.clubStatus || {})[cid]) done++; });
    });
    return total > 0 ? Math.round(done / total * 100) : 0;
  };

  // Upload visuel
  const handleVisuelUpload = async (files) => {
    if (!files) return; setUploading(true);
    for (const file of files) {
      const url = await uploadToStorage(file, `campagnes/${Date.now()}_${file.name}`);
      setForm(p => ({ ...p, visuels: [...(p.visuels || []), { id: uid(), url, name: file.name, channel: "" }] }));
    }
    setUploading(false);
  };

  // Timeline helpers
  const addTimelineItem = (phase) => setForm(p => ({ ...p, timeline: [...p.timeline, { id: uid(), phase, label: "", date: "", done: false }] }));
  const updateTimeline = (id, key, val) => setForm(p => ({ ...p, timeline: p.timeline.map(t => String(t.id) === String(id) ? { ...t, [key]: val } : t) }));
  const delTimeline = (id) => setForm(p => ({ ...p, timeline: p.timeline.filter(t => String(t.id) !== String(id)) }));

  // Generate professional PDF via print
  const downloadPDF = (camp) => {
    const filename = (camp.pdfName || camp.name || "Campagne").trim();
    const PHASE_COLORS_HEX = { "Avant": "#6366F1", "Pendant": "#F59E0B", "Après": "#10B981" };
    const done = (camp.timeline || []).filter(t => t.done).length;
    const total = (camp.timeline || []).length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    const esc = (s) => String(s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sortByDate = (items) => [...items].sort((a, b) => {
      const da = a.date && !["Quotidien","3 fois/semaine","Chaque semaine","En continu","Selon besoin"].includes(a.date) && !a.date.includes("|") ? a.date : "9999";
      const db = b.date && !["Quotidien","3 fois/semaine","Chaque semaine","En continu","Selon besoin"].includes(b.date) && !b.date.includes("|") ? b.date : "9999";
      return da.localeCompare(db);
    });

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(filename)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#2D2D30;font-size:11px}
.page{padding:18mm 14mm;max-width:210mm;margin:0 auto}
.header{background:linear-gradient(135deg,#1E3A5F,#0F56B8);color:#fff;padding:24px 28px;margin-bottom:20px;border-radius:12px}
.header h1{font-size:22px;margin:0 0 4px}
.header .sub{font-size:10px;opacity:0.7}
.header .dates{font-size:12px;margin-top:8px;font-weight:600}
.header .targets{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.target-badge{padding:2px 10px;border-radius:5px;background:rgba(255,255,255,.2);font-size:9px;font-weight:700}
h2{font-size:14px;color:#1E3A5F;margin:22px 0 10px;padding-bottom:6px;border-bottom:2px solid #1E3A5F;page-break-after:avoid}
.box{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px;margin-bottom:10px}
.box-title{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#6B7280;font-weight:600;margin-bottom:6px}
.box-content{font-size:11px;color:#2D2D30;line-height:1.7;white-space:pre-wrap}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px}
.concept-box{background:#F5F3FF;border:1.5px solid #6366F130;border-radius:8px;padding:14px;margin-bottom:10px}
.signature{font-size:13px;font-weight:700;color:#6366F1;font-style:italic;padding:10px 14px;background:#F5F3FF;border-left:3px solid #6366F1;margin:8px 0;white-space:pre-wrap}
.objectives{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.obj{padding:4px 12px;border-radius:6px;background:#0F56B815;color:#0F56B8;font-size:10px;font-weight:600}
.channels{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 10px}
.channel{padding:4px 12px;border-radius:6px;background:#0F56B815;color:#0F56B8;font-size:10px;font-weight:600}
.channel-note{background:#F0F9FF;border-left:3px solid #0F56B8;padding:8px 12px;margin:4px 0 8px;border-radius:0 6px 6px 0;font-size:10px;line-height:1.5}
.channel-note-title{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#0F56B8;font-weight:700;margin-bottom:3px}
.msg-box{background:#F0FDF4;border-left:3px solid #25D366;padding:10px 14px;margin:6px 0;border-radius:0 6px 6px 0}
.msg-box.notif{background:#FFFBEB;border-left-color:#F59E0B}
.msg-label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#6B7280;font-weight:600;margin-bottom:4px}
.msg-meta{font-size:9px;color:#94A3B8;margin-bottom:4px}
.msg-text{font-size:11px;color:#2D2D30;white-space:pre-wrap;line-height:1.5}
.pack-box{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px;margin-bottom:8px}
.pack-name{font-size:12px;font-weight:700;color:#2D2D30;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #E2E8F0}
.pack-item{display:flex;align-items:center;gap:6px;font-size:10px;color:#2D2D30;padding:3px 0;line-height:1.4}
.link-row{display:flex;align-items:center;gap:6px;margin:4px 0;font-size:10px}
.timeline-phase{margin:10px 0}
.phase-title{font-size:11px;font-weight:700;margin-bottom:6px;padding:4px 10px;border-radius:4px;display:inline-block;color:#fff}
.timeline-item{display:flex;align-items:flex-start;gap:8px;padding:6px 10px;margin:3px 0;background:#FAFBFC;border-radius:4px;border-left:3px solid #E2E8F0;page-break-inside:avoid}
.timeline-item.done{background:#F0FDF4;border-left-color:#10B981}
.timeline-check{font-size:12px;flex-shrink:0;margin-top:1px}
.timeline-label{flex:1;font-size:10px;font-weight:600;line-height:1.4}
.timeline-date{font-size:9px;color:#94A3B8;white-space:nowrap;flex-shrink:0}
.timeline-assignees{font-size:8px;color:#6366F1;font-weight:600;margin-top:2px}
.progress{margin:10px 0 16px;display:flex;align-items:center;gap:8px}
.progress-bar{flex:1;height:8px;background:#E2E8F0;border-radius:4px;overflow:hidden}
.progress-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#0F56B8,#10B981)}
.progress-label{font-size:11px;font-weight:700;color:#0F56B8}
.kpi-table{width:100%;border-collapse:collapse;font-size:10px;margin:8px 0}
.kpi-table th{background:#1E3A5F;color:#fff;padding:6px 8px;text-align:left;font-weight:700}
.kpi-table td{padding:5px 8px;border-bottom:1px solid #F1F5F9}
.kpi-table .av{color:#6366F1;font-weight:700;text-align:center}
.kpi-table .ap{color:#10B981;font-weight:700;text-align:center}
.kpi-table .ev{font-weight:700;text-align:center}
.presentation-box{background:#FFFBEB;border:1.5px solid #FEB60130;border-radius:8px;padding:14px;margin-bottom:10px}
.visuel-link{display:flex;align-items:center;gap:6px;padding:6px 10px;background:#F0F9FF;border-radius:6px;margin:4px 0;font-size:10px}
.footer{margin-top:30px;padding-top:10px;border-top:1px solid #E2E8F0;color:#94A3B8;font-size:8px;text-align:center}
.print-btn{position:fixed;top:20px;right:20px;padding:10px 20px;background:#0F56B8;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;z-index:999;font-family:inherit}
@media print{.print-btn{display:none!important}.page{padding:10mm}h2{break-before:auto}.timeline-item{page-break-inside:avoid}}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimer / PDF</button>
<div class="page">

<div class="header">
  <h1>📢 ${esc(camp.name)}</h1>
  <div class="sub">Campagne de communication — Esprit Padel</div>
  <div class="dates">📅 ${camp.dateStart || "—"} → ${camp.dateEnd || "—"}</div>
  ${(camp.targets||[]).length > 0 ? `<div class="targets">${(camp.targets||[]).map(t => `<span class="target-badge">👤 ${esc(t)}</span>`).join("")}</div>` : ""}
</div>

<div class="progress">
  <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
  <span class="progress-label">${pct}% — ${done}/${total} étapes</span>
</div>`;

    // Présentation
    if (camp.presentation) {
      html += `<h2>📣 Présentation</h2><div class="presentation-box"><div class="box-content">${esc(camp.presentation)}</div></div>`;
    }

    // Objectifs
    if ((camp.objectives||[]).length > 0) {
      html += `<h2>🎯 Objectifs</h2><div class="objectives">${(camp.objectives||[]).map(o => `<span class="obj">✓ ${esc(o)}</span>`).join("")}</div>`;
    }

    // Concept + Signature
    if (camp.concept || camp.signature) {
      html += `<h2>💡 Concept & Signature</h2>`;
      if (camp.concept) html += `<div class="concept-box"><div class="box-content">${esc(camp.concept)}</div></div>`;
      if (camp.signature) html += `<div class="signature">${esc(camp.signature)}</div>`;
      if (camp.hashtags) html += `<div style="font-size:11px;color:#6366F1;margin:8px 0">${esc(camp.hashtags)}</div>`;
    }

    // Cible + Positionnement
    html += `<h2>🎯 Cible & Positionnement</h2><div class="grid2">`;
    html += `<div class="box"><div class="box-title">Cible / Persona</div><div class="box-content">${esc(camp.persona||"—")}</div></div>`;
    html += `<div class="box"><div class="box-title">Positionnement & message clé</div><div class="box-content">${esc(camp.positioning||"—")}</div></div>`;
    html += `</div>`;

    // Offre commerciale
    if ((camp.packs||[]).length > 0 || camp.products || camp.carteClub || camp.abonnements || camp.cours || camp.coursIndividuel) {
      html += `<h2>💰 Offre commerciale</h2>`;
      if ((camp.packs||[]).length > 0) {
        html += `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:10px">`;
        (camp.packs||[]).forEach(pack => {
          html += `<div class="pack-box"><div class="pack-name">📦 ${esc(pack.name||"Pack")}</div>`;
          (pack.items||[]).filter(Boolean).forEach(item => { html += `<div class="pack-item">✔️ <span>${esc(item)}</span></div>`; });
          html += `</div>`;
        });
        html += `</div>`;
      }
      html += `<div class="grid2">`;
      if (camp.products) html += `<div class="box"><div class="box-title">🛍️ Produits boutique</div><div class="box-content">${esc(camp.products)}</div></div>`;
      if (camp.carteClub) html += `<div class="box"><div class="box-title">💳 Carte Club</div><div class="box-content">${esc(camp.carteClub)}</div></div>`;
      if (camp.abonnements) html += `<div class="box"><div class="box-title">📅 Abonnements</div><div class="box-content">${esc(camp.abonnements)}</div></div>`;
      if (camp.cours) html += `<div class="box"><div class="box-title">📦 Packs de cours</div><div class="box-content">${esc(camp.cours)}</div></div>`;
      if (camp.coursIndividuel) html += `<div class="box"><div class="box-title">👨‍🏫 Cours individuels</div><div class="box-content">${esc(camp.coursIndividuel)}</div></div>`;
      html += `</div>`;
    }

    // Canaux
    if ((camp.channels||[]).length > 0) {
      html += `<h2>📡 Canaux de diffusion</h2>`;
      html += `<div class="channels">${(camp.channels||[]).map(ch => `<span class="channel">${ch}</span>`).join("")}</div>`;
      (camp.channels||[]).forEach(ch => {
        const note = (camp.channelNotes||{})[ch];
        if (note) html += `<div class="channel-note"><div class="channel-note-title">${ch}</div>${esc(note)}</div>`;
      });
    }

    // Messages WhatsApp
    if ((camp.whatsappMessages||[]).length > 0) {
      html += `<h2>💬 Messages WhatsApp</h2>`;
      (camp.whatsappMessages||[]).forEach((m, i) => {
        html += `<div class="msg-box"><div class="msg-label">WhatsApp n°${i+1}</div><div class="msg-meta">📅 ${m.date||"—"} à ${m.time||"—"} · 👥 ${esc(m.target||"—")}</div><div class="msg-text">${esc(m.text||"")}</div></div>`;
      });
    }

    // Notifications
    if ((camp.notifications||[]).length > 0) {
      html += `<h2>🔔 Notifications mobiles</h2>`;
      (camp.notifications||[]).forEach((n, i) => {
        html += `<div class="msg-box notif"><div class="msg-label">Notification n°${i+1}</div><div class="msg-meta">📅 ${n.date||"—"} à ${n.time||"—"}</div><div style="font-size:11px;font-weight:700;margin-bottom:3px">${esc(n.title||"")}</div><div class="msg-text">${esc(n.body||"")}</div>${n.link ? `<div style="font-size:9px;color:#94A3B8;margin-top:4px">🔗 ${esc(n.link)}</div>` : ""}</div>`;
      });
    }

    // Liens utiles + Liens visuels
    const hasLinks = (camp.links||[]).length > 0;
    const hasVisualLinks = (camp.visualLinks||[]).filter(l => l.url).length > 0;
    if (hasLinks || hasVisualLinks) {
      html += `<h2>🔗 Liens</h2>`;
      if (hasLinks) {
        html += `<div style="margin-bottom:8px;font-size:10px;font-weight:700;color:#6B7280">Liens utiles</div>`;
        (camp.links||[]).forEach(l => {
          html += `<div style="margin-bottom:6px;font-size:10px;font-weight:700;color:#2D2D30">${esc(l.label)}</div>`;
          clubs.forEach(club => {
            const url = ((l.urls||{})[String(club.id)]) || "";
            if (url) html += `<div class="link-row" style="padding-left:12px">🏢 <b>${esc(club.name)}</b> — <a href="${url.startsWith("http") ? url : "https://"+url}" style="color:#0F56B8;font-weight:600;text-decoration:none">${esc(url)}</a></div>`;
            else html += `<div class="link-row" style="padding-left:12px;color:#CBD5E1">🏢 ${esc(club.name)} — Non renseigné</div>`;
          });
        });
      }
      if (hasVisualLinks) {
        html += `<div style="margin:10px 0 6px;font-size:10px;font-weight:700;color:#6B7280">🖼️ Liens visuels</div>`;
        (camp.visualLinks||[]).filter(l => l.url).forEach(l => {
          html += `<div class="visuel-link">🖼️ <a href="${l.url}" style="color:#0F56B8;font-weight:600;text-decoration:none">${esc(l.label||l.url)}</a></div>`;
        });
      }
    }

    // Planning (sorted by date ASC per phase)
    if ((camp.timeline||[]).length > 0) {
      html += `<h2>📋 Planning / Rétroplanning</h2>`;
      ["Avant","Pendant","Après"].forEach(phase => {
        const items = sortByDate((camp.timeline||[]).filter(t => t.phase === phase));
        if (!items.length) return;
        html += `<div class="timeline-phase"><div class="phase-title" style="background:${PHASE_COLORS_HEX[phase]}">${phase}</div>`;
        items.forEach(t => {
          const dateDisplay = t.date ? (t.date.includes("|") ? t.date.split("|").join(" → ") : t.date) : "";
          html += `<div class="timeline-item ${t.done?"done":""}">
            <span class="timeline-check">${t.done?"✅":"⬜"}</span>
            <span class="timeline-label" ${t.done?'style="text-decoration:line-through;color:#94A3B8"':""}>
              ${esc(t.label||"—")}
              ${(t.assignees||[]).length > 0 ? `<div class="timeline-assignees">👤 ${t.assignees.join(" · ")}</div>` : ""}
            </span>
            <span class="timeline-date">${dateDisplay}</span>
          </div>`;
        });
        html += `</div>`;
      });
    }

    // Visuels à prévoir
    if ((camp.visualsTodo||[]).length > 0) {
      html += `<h2>📷 Visuels à prévoir</h2>`;
      (camp.visualsTodo||[]).forEach(v => { html += `<div class="timeline-item ${v.done?"done":""}"><span class="timeline-check">${v.done?"✅":"⬜"}</span><span class="timeline-label">${esc(v.label||"")}</span></div>`; });
    }

    // KPI
    if ((camp.kpiIndicators||[]).length > 0) {
      html += `<h2>📊 KPI — Avant / Après</h2>`;
      html += `<table class="kpi-table"><thead><tr><th>Indicateur</th>${clubs.map(c => `<th colspan="2" style="text-align:center">🏢 ${esc(c.name)}</th>`).join("")}</tr>`;
      html += `<tr><th></th>${clubs.map(() => `<th class="av">📅 Avant</th><th class="ap">✅ Après</th>`).join("")}</tr></thead><tbody>`;
      (camp.kpiIndicators||[]).forEach(k => {
        html += `<tr><td><b>${esc(k.label)}</b>${k.unite ? ` (${esc(k.unite)})` : ""}</td>`;
        clubs.forEach(club => {
          const cid = String(club.id);
          const vals = ((camp.kpiValues||{})[cid]||{})[k.id] || { avant: "", apres: "" };
          const av = parseFloat(vals.avant), ap = parseFloat(vals.apres);
          const diff = vals.avant !== "" && vals.apres !== "" && !isNaN(av) && !isNaN(ap) ? ap - av : null;
          const pct2 = diff !== null && av !== 0 ? Math.round((diff/av)*100) : null;
          html += `<td class="av">${vals.avant !== "" ? vals.avant : "—"}</td>`;
          html += `<td class="ap">${vals.apres !== "" ? vals.apres : "—"}${diff !== null ? `<div class="ev" style="color:${diff>0?"#10B981":"#EF4444"};font-size:8px">${diff>0?"▲+":"▼"}${diff}${pct2!==null?` (${diff>0?"+":""}${pct2}%)`:"" }</div>` : ""}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table>`;
    }

    html += `<div class="footer">Esprit Padel Communication — ${esc(filename)} — Généré le ${new Date().toLocaleDateString("fr-FR")}</div>`;
    html += `</div></body></html>`;

    downloadAsPdf(html, filename);
  };


  const viewCamp = viewing ? campagnes.find(c => String(c.id) === String(viewing) && (isAdmin || c.published)) : null;
  const PHASE_COLORS = { "Avant": "#6366F1", "Pendant": "#F59E0B", "Après": "#10B981" };

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div><h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>📢 Campagnes</h2><div style={{ fontSize: 12, color: "#6B7280" }}>{(isAdmin ? campagnes : campagnes.filter(c => c.published)).length} campagne(s){isAdmin ? ` (${campagnes.filter(c => !c.published).length} brouillon(s))` : ""}</div></div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setMainTab("list")} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: mainTab === "list" ? "#0F56B8" : "#F1F5F9", color: mainTab === "list" ? "#fff" : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📢 Campagnes</button>
          {isAdmin && <button onClick={() => setMainTab("suivi")} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: mainTab === "suivi" ? "#0F56B8" : "#F1F5F9", color: mainTab === "suivi" ? "#fff" : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📋 Suivi actions clubs</button>}
          {isAdmin && mainTab === "list" && <Btn onClick={openNew} small>+ Nouvelle campagne</Btn>}
        </div>
      </div>
      {isAdmin && mainTab === "list" && <span />}

      {/* SUIVI TAB */}
      {mainTab === "suivi" && isAdmin && (<div>
        {/* Campaign selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Sélectionner une campagne</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {campagnes.map(c => (<button key={c.id} onClick={() => setSuiviCamp(String(c.id))} style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${String(suiviCamp) === String(c.id) ? "#0F56B8" : "#E2E8F0"}`, background: String(suiviCamp) === String(c.id) ? "#0F56B815" : "transparent", color: String(suiviCamp) === String(c.id) ? "#0F56B8" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{c.name}{!c.published && " 🔒"}</button>))}
          </div>
        </div>

        {/* Tracking for selected campaign */}
        {suiviCamp && (() => {
          const camp = campagnes.find(c => String(c.id) === String(suiviCamp));
          if (!camp) return null;
          const actions = camp.actions || [];
          const prog = getCampProgress(camp);

          // Filter clubs
          const PHASE_ORDER = { "Avant": 0, "Pendant": 1, "Après": 2 };
          const filteredActions = actions.sort((a, b) => {
            const phaseA = PHASE_ORDER[a.phase] ?? 99;
            const phaseB = PHASE_ORDER[b.phase] ?? 99;
            if (phaseA !== phaseB) return phaseA - phaseB;
            return (a.deadline || "").localeCompare(b.deadline || "");
          }).map(a => {
            const aClubs = (a.clubs || []).length > 0 ? a.clubs : clubs.map(c => c.id);
            let filteredClubs = clubs.filter(c => aClubs.some(id => String(id) === String(c.id)));
            if (suiviFilter === "late") filteredClubs = filteredClubs.filter(c => getActionStatus(a, c.id) === "late");
            if (suiviFilter === "done") filteredClubs = filteredClubs.filter(c => getActionStatus(a, c.id) === "done");
            return { ...a, filteredClubs };
          });

          return (<div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#2D2D30" }}>{camp.name}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>{camp.dateStart} → {camp.dateEnd}</div>
              </div>
              <Btn onClick={() => openNewAction(suiviCamp)} small>+ Nouvelle action</Btn>
            </div>

            {/* Global progress */}
            <Card style={{ padding: 16, marginBottom: 16, background: "linear-gradient(135deg, #0F56B808, #10B98108)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30" }}>📊 Progression globale</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: prog >= 80 ? "#10B981" : prog >= 50 ? "#F59E0B" : "#EF4444" }}>{prog}%</div>
              </div>
              <div style={{ height: 8, background: "#E2E8F0", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: prog + "%", background: prog >= 80 ? "linear-gradient(90deg,#10B981,#059669)" : prog >= 50 ? "linear-gradient(90deg,#F59E0B,#D97706)" : "linear-gradient(90deg,#EF4444,#DC2626)", borderRadius: 4, transition: "width .5s" }} />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {[["all","Tous","#6B7280"], ["done","✅ Terminés","#10B981"], ["late","⏰ En retard","#EF4444"]].map(([f, l, col]) => (
                  <button key={f} onClick={() => setSuiviFilter(f)} style={{ padding: "4px 12px", borderRadius: 8, border: `1.5px solid ${suiviFilter === f ? col : "#E2E8F0"}`, background: suiviFilter === f ? col + "15" : "transparent", color: suiviFilter === f ? col : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
                ))}
              </div>
            </Card>

            {/* Actions list */}
            {actions.length === 0 && <Card style={{ padding: 30, textAlign: "center" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📋</div><div style={{ fontSize: 13, color: "#6B7280" }}>Aucune action. Créez la première !</div></Card>}
            {filteredActions.map(a => {
              const allClubs = (a.clubs || []).length > 0 ? a.clubs : clubs.map(c => c.id);
              const totalC = allClubs.length;
              const doneC = allClubs.filter(cid => (a.clubStatus || {})[cid]).length;
              const lateC = allClubs.filter(cid => getActionStatus(a, cid) === "late").length;
              const actPct = totalC > 0 ? Math.round(doneC / totalC * 100) : 0;
              const isLate = a.deadline && a.deadline < todayStr && doneC < totalC;
              return (<Card key={a.id} style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
                {/* Action header */}
                <div style={{ padding: "12px 14px", background: isLate ? "#FEF2F2" : "#FAFBFC", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30" }}>{a.label}
                      {a.phase && <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: a.phase === "Avant" ? "#6366F115" : a.phase === "Pendant" ? "#F59E0B15" : "#10B98115", color: a.phase === "Avant" ? "#6366F1" : a.phase === "Pendant" ? "#F59E0B" : "#10B981" }}>{a.phase === "Avant" ? "🟣" : a.phase === "Pendant" ? "🟡" : "🟢"} {a.phase}</span>}
                    </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 2, fontSize: 11, color: "#6B7280" }}>
                        {a.deadline && <span style={{ color: isLate ? "#EF4444" : "#6B7280", fontWeight: isLate ? 700 : 400 }}>📅 {a.deadline}{isLate ? " — EN RETARD" : ""}</span>}
                        <span>{doneC}/{totalC} clubs · {actPct}%</span>
                        {lateC > 0 && <span style={{ color: "#EF4444" }}>⚠️ {lateC} en retard</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <div style={{ width: 60, height: 6, background: "#E2E8F0", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: actPct + "%", background: actPct === 100 ? "#10B981" : isLate ? "#EF4444" : "#0F56B8", borderRadius: 3 }} /></div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: actPct === 100 ? "#10B981" : isLate ? "#EF4444" : "#0F56B8" }}>{actPct}%</span>
                      <button onClick={() => openEditAction(suiviCamp, a)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11 }}>✏️</button>
                      <button onClick={() => delAction(suiviCamp, a.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#EF4444" }}>🗑️</button>
                    </div>
                  </div>
                </div>
                {/* Clubs grid */}
                <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 6 }}>
                  {a.filteredClubs.map(c => {
                    const status = getActionStatus(a, c.id);
                    const statusColor = status === "done" ? "#10B981" : status === "late" ? "#EF4444" : "#F59E0B";
                    const statusLabel = status === "done" ? "✅ Terminé" : status === "late" ? "⏰ En retard" : "🕐 En attente";
                    return (<button key={c.id} onClick={() => toggleClubAction(suiviCamp, a.id, c.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${statusColor}30`, background: status === "done" ? "#10B98108" : status === "late" ? "#EF444408" : "#F59E0B08", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all .15s" }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${statusColor}`, background: status === "done" ? statusColor : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{status === "done" && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#2D2D30", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                        <div style={{ fontSize: 9, color: statusColor, fontWeight: 600 }}>{statusLabel}</div>
                      </div>
                    </button>);
                  })}
                  {a.filteredClubs.length === 0 && <div style={{ fontSize: 11, color: "#94A3B8", padding: 8, gridColumn: "1/-1" }}>Aucun club {suiviFilter !== "all" ? "avec ce filtre" : ""}</div>}
                </div>
              </Card>);
            })}
          </div>);
        })()}

        {!suiviCamp && <Card style={{ padding: 40, textAlign: "center" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📋</div><div style={{ fontSize: 13, color: "#6B7280" }}>Sélectionnez une campagne pour voir le suivi de ses actions</div></Card>}

        {/* Action Modal */}
        <Modal open={actionModal} onClose={() => setActionModal(false)} title={editingAction ? "Modifier l'action" : "Nouvelle action"}>
          <Input label="Intitulé de l'action" value={actionForm.label} onChange={v => setActionForm(p => ({ ...p, label: v }))} />
          <Input label="Deadline" value={actionForm.deadline} onChange={v => setActionForm(p => ({ ...p, deadline: v }))} type="date" />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Clubs concernés</label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {clubs.map(c => { const sel = (actionForm.clubs || []).some(x => String(x) === String(c.id)); return (<button key={c.id} onClick={() => setActionForm(p => ({ ...p, clubs: sel ? (p.clubs || []).filter(x => String(x) !== String(c.id)) : [...(p.clubs || []), c.id] }))} style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${sel ? (c.color || "#0F56B8") : "#E2E8F0"}`, background: sel ? (c.color || "#0F56B8") + "12" : "transparent", color: sel ? (c.color || "#0F56B8") : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{c.name}{sel && " ✓"}</button>); })}
              <button onClick={() => setActionForm(p => ({ ...p, clubs: clubs.map(c => c.id) }))} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "transparent", color: "#6B7280", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Tous</button>
            </div>
          </div>
          <Btn onClick={saveAction}>{editingAction ? "Enregistrer" : "Ajouter"}</Btn>
        </Modal>
      </div>)}
    </div>

    {/* Detail + List view */}
    {mainTab === "list" && viewCamp && (<div>
      <button onClick={() => setViewing(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#0F56B8", fontWeight: 600, marginBottom: 12, fontFamily: "inherit" }}>← Retour aux campagnes</button>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#2D2D30" }}>{viewCamp.name}</h2>
          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>📅 {viewCamp.dateStart} → {viewCamp.dateEnd}</div>
          {(viewCamp.targets || []).length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              <span style={{ fontSize: 11, color: "#6B7280", alignSelf: "center" }}>👥 Pour :</span>
              {(viewCamp.targets || []).map(t => {
                const cols = { "Alternant communication": "#6366F1", "Responsable communication": "#0F56B8", "Directeur d'exploitation": "#1E3A5F", "Commercial": "#10B981", "Juge arbitre": "#F59E0B" };
                const col = cols[t] || "#6B7280";
                return <span key={t} style={{ padding: "3px 10px", borderRadius: 8, background: col + "15", color: col, fontSize: 11, fontWeight: 700 }}>{t}</span>;
              })}
            </div>
          )}
          {viewCamp.positioning && <div style={{ fontSize: 13, color: "#6366F1", fontStyle: "italic", marginTop: 4 }}>« {viewCamp.positioning} »</div>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => downloadPDF(viewCamp)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#0F56B8", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📥 PDF</button>
          <button onClick={() => {
            const camp = viewCamp;
            const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Esprit Padel//Campagne//FR","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
            (camp.timeline||[]).filter(t => t.date && !t.date.includes("|") && !["Quotidien","3 fois/semaine","Chaque semaine","En continu","Selon besoin"].includes(t.date)).forEach(t => {
              const d = t.date.replace(/-/g,"");
              const now = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
              lines.push("BEGIN:VEVENT",`UID:${t.id}@espritpadel`,`DTSTAMP:${now}`,`DTSTART;VALUE=DATE:${d}`,`DTEND;VALUE=DATE:${d}`,`SUMMARY:${(t.label||"Action").replace(/,/g,"\\,")} [${t.phase}]`,`DESCRIPTION:${(t.assignees||[]).join(", ")}`,`CATEGORIES:${t.phase}`,"END:VEVENT");
            });
            (camp.whatsappMessages||[]).filter(m => m.date).forEach(m => {
              const d = m.date.replace(/-/g,"");
              const now = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
              lines.push("BEGIN:VEVENT",`UID:wa-${m.id}@espritpadel`,`DTSTAMP:${now}`,`DTSTART;VALUE=DATE:${d}`,`DTEND;VALUE=DATE:${d}`,`SUMMARY:💬 WhatsApp ${m.time||""} – ${(m.target||"").slice(0,30)}`,`DESCRIPTION:${(m.text||"").slice(0,80).replace(/\n/g,"\\n")}`,"END:VEVENT");
            });
            (camp.notifications||[]).filter(n => n.date).forEach(n => {
              const d = n.date.replace(/-/g,"");
              const now = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
              lines.push("BEGIN:VEVENT",`UID:notif-${n.id}@espritpadel`,`DTSTAMP:${now}`,`DTSTART;VALUE=DATE:${d}`,`DTEND;VALUE=DATE:${d}`,`SUMMARY:🔔 ${n.time||""} – ${(n.title||"").slice(0,40)}`,`DESCRIPTION:${(n.body||"").slice(0,80).replace(/\n/g,"\\n")}`,"END:VEVENT");
            });
            lines.push("END:VCALENDAR");
            const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `${(camp.name||"Campagne").replace(/[^a-zA-Z0-9]/g,"_")}.ics`; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 3000);
          }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#10B981", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📅 Ajouter au calendrier iPhone</button>
          {isAdmin && <button onClick={() => { setCampagnes(p => p.map(x => String(x.id) === String(viewCamp.id) ? { ...x, published: !x.published } : x)); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: viewCamp.published ? "#F59E0B" : "#10B981", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{viewCamp.published ? "🔒 Masquer" : "👁️ Publier"}</button>}
          {isAdmin && <button onClick={() => openEdit(viewCamp)} style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✏️ Modifier</button>}
        </div>
      </div>

      {/* ── Présentation ── */}
      {viewCamp.presentation && (
        <Card style={{ padding: 20, marginBottom: 16, background: "linear-gradient(135deg,#FEB60108,#fff)", border: "1px solid #FEB60130" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#2D2D30", marginBottom: 12 }}>📣 Présentation de la campagne</div>
          <pre style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", color: "#2D2D30", fontFamily: "Montserrat, sans-serif", margin: 0 }}>{viewCamp.presentation}</pre>
        </Card>
      )}

      {/* ── Objectifs ── */}
      {(viewCamp.objectives || []).length > 0 && (
        <Card style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#2D2D30", marginBottom: 12 }}>🎯 Objectifs</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {viewCamp.objectives.map((obj, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#F8FAFC", borderRadius: 8, borderLeft: "3px solid #0F56B8" }}>
                <span style={{ fontSize: 14, color: "#0F56B8", fontWeight: 700 }}>→</span>
                <span style={{ fontSize: 13, color: "#2D2D30", fontWeight: 600 }}>{obj}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Concept & Signature ── */}
      {(viewCamp.concept || viewCamp.signature) && (
        <div style={{ display: "grid", gridTemplateColumns: viewCamp.concept && viewCamp.signature ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 16 }}>
          {viewCamp.concept && (
            <Card style={{ padding: 18, background: "linear-gradient(135deg,#6366F105,#EC489905)", border: "1.5px solid #6366F120" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#6366F1", marginBottom: 10 }}>💡 Concept</div>
              <div style={{ fontSize: 13, color: "#2D2D30", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{viewCamp.concept}</div>
            </Card>
          )}
          {viewCamp.signature && (
            <Card style={{ padding: 18, background: "linear-gradient(135deg,#FEB60105,#F59E0B05)", border: "1.5px solid #FEB60120" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#F59E0B", marginBottom: 10 }}>✍️ Signature</div>
              <div style={{ fontSize: 13, color: "#2D2D30", lineHeight: 1.8, whiteSpace: "pre-wrap", fontStyle: "italic" }}>{viewCamp.signature}</div>
            </Card>
          )}
        </div>
      )}

      {/* ── Offre commerciale : Packs ── */}
      {(viewCamp.packs || []).length > 0 && (
        <Card style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#2D2D30", marginBottom: 12 }}>📦 L'offre commerciale — Packs</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            {viewCamp.packs.map((pack, i) => {
              const packColors = ["#0F56B8","#10B981","#EC4899","#F59E0B","#6366F1","#EF4444"];
              const col = packColors[i % packColors.length];
              return (
                <div key={pack.id} style={{ padding: 14, borderRadius: 12, border: `2px solid ${col}20`, background: col + "08" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: col, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>{pack.name}</div>
                  {pack.items.filter(Boolean).map((item, ii) => (
                    <div key={ii} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 12, color: "#2D2D30" }}>
                      <span style={{ color: "#10B981", fontWeight: 700 }}>✔️</span>{item}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Produits à mettre en avant ── */}
      {(viewCamp.products || viewCamp.carteClub || viewCamp.abonnements || viewCamp.cours || viewCamp.coursIndividuel) && (
        <Card style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#2D2D30", marginBottom: 12 }}>🛍️ Produits & services à mettre en avant</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            {viewCamp.products && <div style={{ padding: 14, background: "#F8FAFC", borderRadius: 10, borderLeft: "3px solid #EC4899" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#EC4899", marginBottom: 6 }}>🛍️ Boutique</div><div style={{ fontSize: 12, color: "#2D2D30", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{viewCamp.products}</div></div>}
            {viewCamp.carteClub && <div style={{ padding: 14, background: "#F8FAFC", borderRadius: 10, borderLeft: "3px solid #6366F1" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#6366F1", marginBottom: 6 }}>💳 Carte Club</div><div style={{ fontSize: 12, color: "#2D2D30", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{viewCamp.carteClub}</div></div>}
            {viewCamp.cours && <div style={{ padding: 14, background: "#F8FAFC", borderRadius: 10, borderLeft: "3px solid #10B981" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#10B981", marginBottom: 6 }}>📦 Packs de cours</div><div style={{ fontSize: 12, color: "#2D2D30", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{viewCamp.cours}</div></div>}
            {viewCamp.coursIndividuel && <div style={{ padding: 14, background: "#F8FAFC", borderRadius: 10, borderLeft: "3px solid #0F56B8" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#0F56B8", marginBottom: 6 }}>👨‍🏫 Cours individuels</div><div style={{ fontSize: 12, color: "#2D2D30", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{viewCamp.coursIndividuel}</div></div>}
            {viewCamp.abonnements && <div style={{ padding: 14, background: "#F8FAFC", borderRadius: 10, borderLeft: "3px solid #F59E0B" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", marginBottom: 6 }}>📅 Abonnements</div><div style={{ fontSize: 12, color: "#2D2D30", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{viewCamp.abonnements}</div></div>}
          </div>
        </Card>
      )}

      {/* ── Messages WhatsApp ── */}
      {(viewCamp.whatsappMessages || []).length > 0 && (
        <Card style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#25D366", marginBottom: 12 }}>💬 Messages WhatsApp ({viewCamp.whatsappMessages.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {viewCamp.whatsappMessages.map((msg, i) => (
              <div key={msg.id} style={{ padding: 14, background: "#F0FDF4", borderRadius: 10, border: "1px solid #25D36630" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 6, background: "#25D36615", color: "#25D366", fontSize: 10, fontWeight: 700 }}>WhatsApp n°{i + 1}</span>
                  {msg.date && <span style={{ fontSize: 11, color: "#6B7280" }}>📅 {msg.date} à {msg.time}</span>}
                  {msg.target && <span style={{ fontSize: 10, color: "#94A3B8" }}>· {msg.target}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#2D2D30", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{msg.text}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Notifications ── */}
      {(viewCamp.notifications || []).length > 0 && (
        <Card style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#F59E0B", marginBottom: 12 }}>🔔 Notifications mobiles ({viewCamp.notifications.length})</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {viewCamp.notifications.map((notif, i) => (
              <div key={notif.id} style={{ padding: 14, background: "#FFFBEB", borderRadius: 10, border: "1px solid #F59E0B30" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 6, background: "#F59E0B15", color: "#F59E0B", fontSize: 10, fontWeight: 700 }}>Notif n°{i + 1}</span>
                  {notif.date && <span style={{ fontSize: 10, color: "#94A3B8" }}>{notif.date} {notif.time}</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30", marginBottom: 4 }}>{notif.title}</div>
                <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>{notif.body}</div>
                {notif.link && <div style={{ fontSize: 10, color: "#0F56B8", marginTop: 6 }}>🔗 {notif.link}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Canaux ── */}
      {(viewCamp.channels || []).length > 0 && (
        <Card style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#2D2D30", marginBottom: 12 }}>📡 Canaux de diffusion</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {viewCamp.channels.map(ch => (
              <div key={ch} style={{ padding: "8px 12px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                <span style={{ padding: "3px 10px", borderRadius: 6, background: "#0F56B815", color: "#0F56B8", fontSize: 11, fontWeight: 700 }}>{ch}</span>
                {(viewCamp.channelNotes || {})[ch] && <div style={{ fontSize: 12, color: "#2D2D30", marginTop: 6, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{(viewCamp.channelNotes || {})[ch]}</div>}
              </div>
            ))}
          </div>
          {viewCamp.hashtags && <div style={{ marginTop: 12, fontSize: 12, color: "#6366F1", fontWeight: 600 }}>{viewCamp.hashtags}</div>}
        </Card>
      )}

      {/* ── Liens ── */}
      {(viewCamp.links || []).length > 0 && (
        <Card style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#2D2D30", marginBottom: 4 }}>🔗 Liens utiles</div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 12 }}>Renseignez le lien de votre club pour chaque intitulé</div>
          {physicalClubs.map(club => (
            <div key={club.id} style={{ marginBottom: 12, padding: "10px 12px", background: (club.color||"#0F56B8") + "08", borderRadius: 10, border: `1px solid ${club.color||"#0F56B8"}20` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: club.color || "#0F56B8", marginBottom: 8 }}>🏢 {club.name}</div>
              {(viewCamp.links||[]).map(l => {
                const url = ((l.urls||{})[String(club.id)]) || "";
                const canEdit = isAdmin || String(currentUser?.club) === String(club.id) || String(currentUser?.clubId) === String(club.id) || (currentUser?.clubs||[]).map(String).includes(String(club.id));
                const qrUrl = url ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=${encodeURIComponent(url.startsWith("http") ? url : "https://"+url)}` : "";
                return (
                  <div key={l.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#2D2D30", marginBottom: 4 }}>{l.label || "—"}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {url ? (
                        <>
                          <a href={url.startsWith("http") ? url : `https://${url}`} target="_blank" rel="noreferrer"
                            style={{ flex: 1, fontSize: 11, color: "#0F56B8", fontWeight: 600, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "5px 8px", background: "#0F56B808", borderRadius: 6, border: "1px solid #0F56B820" }}>
                            🔗 {url} ↗
                          </a>
                          <a href={qrUrl} target="_blank" rel="noreferrer" title="Télécharger le QR Code"
                            style={{ padding: "5px 10px", borderRadius: 6, background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 11, color: "#2D2D30", textDecoration: "none", flexShrink: 0, cursor: "pointer" }}>
                            📱 QR
                          </a>
                          <button onClick={() => {
                            const modal = document.createElement("div");
                            modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center";
                            modal.innerHTML = `<div style="background:#fff;border-radius:16px;padding:24px;text-align:center;max-width:320px;width:90%">
                              <div style="font-size:13px;font-weight:700;margin-bottom:4px">${l.label}</div>
                              <div style="font-size:10px;color:#94A3B8;margin-bottom:14px">${club.name}</div>
                              <img src="${qrUrl}" style="width:220px;height:220px;border-radius:8px;border:1px solid #E2E8F0" />
                              <div style="font-size:9px;color:#94A3B8;margin-top:8px;word-break:break-all">${url}</div>
                              <a href="${qrUrl}" download="QR_${(l.label||"lien").replace(/\s+/g,"_")}_${club.name}.png" style="display:inline-block;margin-top:12px;padding:8px 16px;background:#0F56B8;color:#fff;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none">⬇ Télécharger</a>
                              <button onclick="this.closest('div[style*=fixed]').remove()" style="display:block;width:100%;margin-top:8px;background:none;border:none;color:#94A3B8;font-size:12px;cursor:pointer">Fermer</button>
                            </div>`;
                            modal.onclick = e => { if (e.target === modal) modal.remove(); };
                            document.body.appendChild(modal);
                          }} style={{ padding: "5px 10px", borderRadius: 6, background: "#6366F115", border: "1px solid #6366F130", fontSize: 11, color: "#6366F1", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                            🖼️ Voir QR
                          </button>
                          {canEdit && <button onClick={() => {
                            setCampagnes(prev => prev.map(c => String(c.id) === String(viewCamp.id) ? { ...c, links: (c.links||[]).map(x => x.id === l.id ? { ...x, urls: { ...(x.urls||{}), [String(club.id)]: "" } } : x) } : c));
                          }} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 12, flexShrink: 0 }}>✕</button>}
                        </>
                      ) : (
                        canEdit ? (
                          <input
                            defaultValue=""
                            onBlur={e => {
                              if (!e.target.value.trim()) return;
                              setCampagnes(prev => prev.map(c => String(c.id) === String(viewCamp.id) ? { ...c, links: (c.links||[]).map(x => x.id === l.id ? { ...x, urls: { ...(x.urls||{}), [String(club.id)]: e.target.value.trim() } } : x) } : c));
                              e.target.value = "";
                            }}
                            onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
                            placeholder="Collez le lien ici..."
                            style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1.5px dashed #CBD5E1", fontSize: 11, fontFamily: "inherit", color: "#94A3B8" }}
                          />
                        ) : <span style={{ flex: 1, fontSize: 11, color: "#CBD5E1", fontStyle: "italic" }}>Non renseigné</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </Card>
      )}

      {/* ── Planning / Rétroplanning ── */}
      {(viewCamp.timeline || []).length > 0 && (
        <Card style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#2D2D30", marginBottom: 12 }}>📅 Planning / Rétroplanning</div>
          {["Avant","Pendant","Après"].map(phase => {
            const items = [...(viewCamp.timeline || []).filter(t => t.phase === phase)].sort((a, b) => {
              const da = a.date && !["Quotidien","3 fois/semaine","Chaque semaine","En continu","Selon besoin"].includes(a.date) && !a.date.includes("|") ? a.date : "9999";
              const db = b.date && !["Quotidien","3 fois/semaine","Chaque semaine","En continu","Selon besoin"].includes(b.date) && !b.date.includes("|") ? b.date : "9999";
              return da.localeCompare(db);
            });
            if (!items.length) return null;
            const col = phase === "Avant" ? "#6366F1" : phase === "Pendant" ? "#F59E0B" : "#10B981";
            const done = items.filter(t => t.done).length;
            return (
              <div key={phase} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: col, display: "inline-block" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: col }}>{phase}</span>
                  <span style={{ fontSize: 10, color: "#94A3B8" }}>{done}/{items.length} terminé{done > 1 ? "s" : ""}</span>
                </div>
                {items.map(t => {
                  const roleColors = { "Alternant":"#8B5CF6","Responsable com":"#0F56B8","Directeur d'exploitation":"#1E3A5F","Commercial":"#10B981","Juge arbitre":"#F59E0B" };
                  const clubStatuses = t.clubStatus || {}; // { clubId: true/false }
                  const allChecked = physicalClubs.length > 0 && physicalClubs.every(c => clubStatuses[String(c.id)]);
                  const someChecked = physicalClubs.some(c => clubStatuses[String(c.id)]);

                  const toggleClub = (clubId) => {
                    setCampagnes(prev => prev.map(camp => {
                      if (String(camp.id) !== String(viewCamp.id)) return camp;
                      const newTimeline = (camp.timeline||[]).map(item => {
                        if (item.id !== t.id) return item;
                        const newStatus = { ...(item.clubStatus||{}), [String(clubId)]: !clubStatuses[String(clubId)] };
                        const nowAllDone = physicalClubs.every(c => newStatus[String(c.id)]);
                        return { ...item, clubStatus: newStatus, done: nowAllDone };
                      });
                      return { ...camp, timeline: newTimeline };
                    }));
                  };

                  return (
                    <div key={t.id} style={{ padding: "10px 12px", marginBottom: 6, background: allChecked ? "#F0FDF4" : someChecked ? "#FFFBEB" : "#FAFBFC", borderRadius: 8, borderLeft: `3px solid ${allChecked ? "#10B981" : someChecked ? "#F59E0B" : col}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{allChecked ? "✅" : someChecked ? "🔄" : "⬜"}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#2D2D30", flex: 1, textDecoration: allChecked ? "line-through" : "none" }}>{t.label}</span>
                        {t.date && <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: "monospace", flexShrink: 0 }}>{t.date.includes("|") ? `${t.date.split("|")[0]} → ${t.date.split("|")[1]}` : t.date}</span>}
                        {t.date && !["Quotidien","3 fois/semaine","Chaque semaine","En continu","Selon besoin"].includes(t.date) && (
                          <button onClick={() => {
                            const d1 = t.date.includes("|") ? t.date.split("|")[0].replace(/-/g,"") : t.date.replace(/-/g,"");
                            const d2 = t.date.includes("|") ? t.date.split("|")[1].replace(/-/g,"") : t.date.replace(/-/g,"");
                            const now = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
                            const assignees = (t.assignees||[]).join(", ");
                            const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Esprit Padel//FR","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",`UID:${t.id}@espritpadel`,`DTSTAMP:${now}`,`DTSTART;VALUE=DATE:${d1}`,`DTEND;VALUE=DATE:${d2}`,`SUMMARY:${(t.label||"").replace(/,/g,"\\,")} [${t.phase}]`,`DESCRIPTION:${assignees}`,`CATEGORIES:${t.phase}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");
                            const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a"); a.href = url; a.download = `${(t.label||"action").replace(/[^a-zA-Z0-9]/g,"_").slice(0,30)}.ics`; a.click();
                            setTimeout(() => URL.revokeObjectURL(url), 3000);
                          }} title="Ajouter au calendrier" style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #0F56B820", background: "#0F56B808", color: "#0F56B8", fontSize: 10, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>📅</button>
                        )}
                      </div>
                      {(t.assignees || []).length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5, paddingLeft: 24 }}>
                          {(t.assignees || []).map(role => <span key={role} style={{ padding: "2px 8px", borderRadius: 6, background: (roleColors[role]||"#6B7280"), color: "#fff", fontSize: 9, fontWeight: 700 }}>👤 {role}</span>)}
                        </div>
                      )}
                      {/* Club checkboxes */}
                      {physicalClubs.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, paddingLeft: 24 }}>
                          {physicalClubs.map(club => {
                            const checked = !!clubStatuses[String(club.id)];
                            return (
                              <button key={club.id} onClick={() => toggleClub(club.id)}
                                style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, border: `1.5px solid ${checked ? "#10B981" : "#E2E8F0"}`, background: checked ? "#10B98115" : "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: checked ? "#10B981" : "#6B7280" }}>
                                <span style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${checked ? "#10B981" : "#CBD5E1"}`, background: checked ? "#10B981" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  {checked && <span style={{ color: "#fff", fontSize: 8, fontWeight: 800 }}>✓</span>}
                                </span>
                                {club.name}
                              </button>
                            );
                          })}
                          {allChecked && <span style={{ fontSize: 10, color: "#10B981", fontWeight: 700, display: "flex", alignItems: "center" }}>✅ Tous les clubs ont validé</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </Card>
      )}

      {/* ── Liens visuels ── */}
      {(viewCamp.visualLinks || []).length > 0 && (
        <Card style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#2D2D30", marginBottom: 10 }}>🖼️ Liens vers les visuels</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(viewCamp.visualLinks || []).map(vl => (
              <a key={vl.id} href={vl.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0", textDecoration: "none" }}>
                <span style={{ fontSize: 16 }}>🔗</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F56B8" }}>{vl.label || vl.url}</div>
                  <div style={{ fontSize: 10, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>{vl.url}</div>
                </div>
                <span style={{ fontSize: 11, color: "#0F56B8" }}>↗</span>
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* ── Visuels à prévoir ── */}
      {(viewCamp.visualsTodo || []).length > 0 && (
        <Card style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#2D2D30", marginBottom: 10 }}>📷 Visuels à prévoir</div>
          {viewCamp.visualsTodo.map(v => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12, color: v.done ? "#94A3B8" : "#2D2D30", textDecoration: v.done ? "line-through" : "none" }}>
              <span>{v.done ? "✅" : "⬜"}</span>{v.label}
            </div>
          ))}
        </Card>
      )}

      {(viewCamp.visualsTodo || []).length > 0 && (
        <Card style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#2D2D30", marginBottom: 10 }}>📷 Visuels à prévoir</div>
          {viewCamp.visualsTodo.map(v => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12, color: v.done ? "#94A3B8" : "#2D2D30", textDecoration: v.done ? "line-through" : "none" }}>
              <span>{v.done ? "✅" : "⬜"}</span>{v.label}
            </div>
          ))}
        </Card>
      )}

      {/* ── KPI Avant / Après ── */}
      {(viewCamp.kpiIndicators || []).length > 0 && (
        <Card style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#2D2D30" }}>📊 KPI — Avant / Après</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>
              <span style={{ color: "#6366F1", fontWeight: 700 }}>📅 Avant</span> : saisissable par les alternants · <span style={{ color: "#10B981", fontWeight: 700 }}>✅ Après</span> : admin uniquement
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
              <thead>
                <tr>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#6B7280", borderBottom: "2px solid #E2E8F0", minWidth: 160, background: "#FAFBFC" }}>Indicateur</th>
                  {physicalClubs.map(club => (
                    <th key={club.id} colSpan={2} style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: club.color || "#0F56B8", borderBottom: "2px solid #E2E8F0", borderLeft: "2px solid #E2E8F0", background: (club.color || "#0F56B8") + "08", minWidth: 160 }}>🏢 {club.name}</th>
                  ))}
                </tr>
                <tr>
                  <th style={{ padding: "5px 12px", background: "#FAFBFC", borderBottom: "1px solid #F1F5F9" }}></th>
                  {physicalClubs.map(club => (
                    <React.Fragment key={club.id}>
                      <th style={{ padding: "5px 8px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "#6366F1", borderBottom: "1px solid #F1F5F9", borderLeft: "2px solid #E2E8F0", background: "#6366F108", width: 90 }}>
                        📅 Avant<div style={{ fontSize: 8, color: "#8B5CF6", fontWeight: 400 }}>Alternant</div>
                      </th>
                      <th style={{ padding: "5px 8px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "#10B981", borderBottom: "1px solid #F1F5F9", background: "#10B98108", width: 90 }}>
                        ✅ Après<div style={{ fontSize: 8, color: "#10B981", fontWeight: 400 }}>{isAdmin ? "Admin" : "—"}</div>
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(viewCamp.kpiIndicators || []).map(k => (
                  <tr key={k.id} style={{ borderBottom: "1px solid #F4F2EF" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: "#2D2D30", background: "#FAFBFC" }}>
                      {k.label}{k.unite && <span style={{ color: "#94A3B8", fontWeight: 400 }}> ({k.unite})</span>}
                    </td>
                    {physicalClubs.map(club => {
                      const cid = String(club.id);
                      const vals = ((viewCamp.kpiValues || {})[cid] || {})[k.id] || { avant: "", apres: "" };
                      const av = parseFloat(vals.avant);
                      const ap = parseFloat(vals.apres);
                      const diff = vals.avant !== "" && vals.apres !== "" && !isNaN(av) && !isNaN(ap) ? ap - av : null;
                      const pct = diff !== null && av !== 0 ? Math.round((diff / av) * 100) : null;
                      const updateKpiVal = (field, val) => {
                        setCampagnes(prev => prev.map(c => {
                          if (String(c.id) !== String(viewCamp.id)) return c;
                          const kv = JSON.parse(JSON.stringify(c.kpiValues || {}));
                          if (!kv[cid]) kv[cid] = {};
                          if (!kv[cid][k.id]) kv[cid][k.id] = { avant: "", apres: "" };
                          kv[cid][k.id][field] = val;
                          return { ...c, kpiValues: kv };
                        }));
                      };
                      return (
                        <React.Fragment key={club.id}>
                          <td style={{ padding: "5px 6px", borderLeft: "2px solid #E2E8F0", background: "#6366F104" }}>
                            <input
                              type="number"
                              value={vals.avant}
                              onChange={e => updateKpiVal("avant", e.target.value)}
                              placeholder="0"
                              style={{ width: "100%", padding: "5px 6px", borderRadius: 5, border: "1px solid #6366F130", background: "transparent", fontSize: 12, fontFamily: "inherit", textAlign: "center" }}
                            />
                          </td>
                          <td style={{ padding: "5px 6px", background: "#10B98104" }}>
                            <input
                              type="number"
                              value={vals.apres}
                              onChange={e => updateKpiVal("apres", e.target.value)}
                              placeholder="0"
                              disabled={!isAdmin}
                              style={{ width: "100%", padding: "5px 6px", borderRadius: 5, border: "1px solid #10B98130", background: "transparent", fontSize: 12, fontFamily: "inherit", textAlign: "center", cursor: isAdmin ? "text" : "not-allowed", opacity: isAdmin ? 1 : 0.4 }}
                            />
                            {diff !== null && (
                              <div style={{ fontSize: 9, fontWeight: 700, color: diff > 0 ? "#10B981" : "#EF4444", textAlign: "center", marginTop: 2 }}>
                                {diff > 0 ? "▲+" : "▼"}{diff}{pct !== null ? ` (${diff > 0 ? "+" : ""}${pct}%)` : ""}
                              </div>
                            )}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(viewCamp.visuels || []).length > 0 && (
        <Card style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#2D2D30", marginBottom: 10 }}>🖼️ Visuels</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
            {viewCamp.visuels.map(v => (
              <div key={v.id} style={{ borderRadius: 10, overflow: "hidden", border: "1.5px solid #E2E8F0" }}>
                <img src={v.url} alt={v.name} style={{ width: "100%", height: 120, objectFit: "cover" }} />
                <div style={{ padding: 6 }}><div style={{ fontSize: 10, color: "#2D2D30", fontWeight: 600 }}>{v.name}</div>{v.channel && <div style={{ fontSize: 9, color: "#6B7280" }}>{v.channel}</div>}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>)}
    {mainTab === "list" && !viewCamp && (
      /* List view */
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {(isAdmin ? campagnes : campagnes.filter(c => c.published)).sort((a, b) => (b.dateStart || "").localeCompare(a.dateStart || "")).map(c => {
          const now = new Date().toISOString().split("T")[0];
          const isActive = c.dateStart <= now && c.dateEnd >= now;
          const isPast = c.dateEnd < now;
          const done = (c.timeline || []).filter(t => t.done).length;
          const total = (c.timeline || []).length;
          return (<Card key={c.id} style={{ padding: 14, borderLeft: `4px solid ${!c.published ? "#F59E0B" : isActive ? "#10B981" : isPast ? "#94A3B8" : "#6366F1"}`, cursor: "pointer", opacity: !c.published ? 0.85 : 1 }} onClick={() => setViewing(c.id)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div><div style={{ fontSize: 15, fontWeight: 700, color: "#2D2D30" }}>{c.name}</div><div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>📅 {c.dateStart} → {c.dateEnd}</div><div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>{!c.published && <span style={{ padding: "2px 8px", borderRadius: 6, background: "#F59E0B15", color: "#F59E0B", fontSize: 10, fontWeight: 700 }}>🔒 Brouillon</span>}<span style={{ padding: "2px 8px", borderRadius: 6, background: isActive ? "#10B98115" : isPast ? "#94A3B815" : "#6366F115", color: isActive ? "#10B981" : isPast ? "#94A3B8" : "#6366F1", fontSize: 10, fontWeight: 600 }}>{isActive ? "En cours" : isPast ? "Terminée" : "À venir"}</span>{(c.targets || []).map(t => { const cols = { "Alternant communication": "#6366F1", "Responsable communication": "#0F56B8", "Directeur d'exploitation": "#1E3A5F", "Commercial": "#10B981", "Juge arbitre": "#F59E0B" }; const col = cols[t] || "#6B7280"; return <span key={t} style={{ padding: "2px 8px", borderRadius: 6, background: col + "15", color: col, fontSize: 10, fontWeight: 600 }}>👥 {t}</span>; })}</div></div>
              {isAdmin && <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}><button onClick={() => { setCampagnes(p => p.map(x => String(x.id) === String(c.id) ? { ...x, published: !x.published } : x)); }} title={c.published ? "Masquer" : "Publier"} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11 }}>{c.published ? "👁️" : "🔒"}</button><button onClick={() => openEdit(c)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11 }}>✏️</button><button onClick={() => del(c.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#EF4444" }}>🗑️</button></div>}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>{(c.channels || []).slice(0, 4).map(ch => <span key={ch} style={{ padding: "1px 6px", borderRadius: 4, background: "#F1F5F9", color: "#6B7280", fontSize: 9, fontWeight: 600 }}>{ch}</span>)}</div>
            {total > 0 && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}><div style={{ flex: 1, height: 4, background: "#E2E8F0", borderRadius: 2 }}><div style={{ height: "100%", width: `${Math.round(done / total * 100)}%`, background: "#10B981", borderRadius: 2 }} /></div><span style={{ fontSize: 10, color: "#6B7280" }}>{done}/{total}</span></div>}
          </Card>);
        })}
        {(isAdmin ? campagnes : campagnes.filter(c => c.published)).length === 0 && <Card style={{ padding: 30, textAlign: "center", gridColumn: "1/-1" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📢</div><div style={{ fontSize: 13, color: "#6B7280" }}>Aucune campagne{isAdmin ? ". Créez la première !" : ""}</div></Card>}
      </div>
    )}
    {/* Create/Edit Modal */}
    <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Modifier la campagne" : "Nouvelle campagne"} wide>
      {/* Tab nav */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap", borderBottom: "2px solid #F1F5F9", paddingBottom: 10 }}>
        {[
          ["identite","📋 Identité"],
          ["objectifs","🎯 Objectifs"],
          ["concept","💡 Concept"],
          ["offre","💰 Offre"],
          ["canaux","📡 Canaux"],
          ["planning","📅 Planning"],
          ["kpi","📊 KPI"],
          ["presentation","📣 Présentation"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setFormTab(id)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: formTab === id ? "#0F56B8" : "#F1F5F9", color: formTab === id ? "#fff" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
        ))}
      </div>

      {/* ── IDENTITÉ ── */}
      {formTab === "identite" && (<div>
        <Input label="Nom de la campagne" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Back to Padel 2026" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <Input label="Date début" value={form.dateStart} onChange={v => setForm(p => ({ ...p, dateStart: v }))} type="date" />
          <Input label="Date fin" value={form.dateEnd} onChange={v => setForm(p => ({ ...p, dateEnd: v }))} type="date" />
        </div>
        <Textarea label="🎯 Cible / Persona" value={form.persona} onChange={v => setForm(p => ({ ...p, persona: v }))} rows={3} placeholder="Joueurs loisirs, anciens clients, familles..." />
        <Textarea label="💡 Positionnement & message clé" value={form.positioning} onChange={v => setForm(p => ({ ...p, positioning: v }))} rows={3} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", marginBottom: 14, borderTop: "1px solid #F1F5F9" }}>
          <div><div style={{ fontSize: 12, fontWeight: 600, color: "#2D2D30" }}>{form.published ? "👁️ Publiée (visible par tous)" : "🔒 Brouillon (admin seulement)"}</div></div>
          <button onClick={() => setForm(p => ({ ...p, published: !p.published }))} style={{ width: 48, height: 26, borderRadius: 13, border: "none", background: form.published ? "#10B981" : "#CBD5E1", cursor: "pointer", position: "relative" }}><span style={{ position: "absolute", top: 3, left: form.published ? 24 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} /></button>
        </div>
        <Input label="📄 Nom du fichier PDF" value={form.pdfName} onChange={v => setForm(p => ({ ...p, pdfName: v }))} />

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>👥 Destinataires de la campagne</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Alternant communication", "Responsable communication", "Directeur d'exploitation", "Commercial", "Juge arbitre"].map(role => {
              const sel = (form.targets || []).includes(role);
              const colors = {
                "Alternant communication": "#6366F1",
                "Responsable communication": "#0F56B8",
                "Directeur d'exploitation": "#1E3A5F",
                "Commercial": "#10B981",
                "Juge arbitre": "#F59E0B"
              };
              const col = colors[role] || "#6B7280";
              return (
                <button key={role} onClick={() => setForm(p => ({ ...p, targets: sel ? (p.targets || []).filter(t => t !== role) : [...(p.targets || []), role] }))} style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${sel ? col : "#E2E8F0"}`, background: sel ? col + "15" : "transparent", color: sel ? col : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {sel ? "✓ " : ""}{role}
                </button>
              );
            })}
          </div>
          {(form.targets || []).length > 0 && (
            <div style={{ marginTop: 6, fontSize: 10, color: "#94A3B8" }}>Sélectionné : {(form.targets || []).join(", ")}</div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>👥 Destinataires / Rôles concernés</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Alternant", "Responsable com", "Directeur d'exploitation", "Commercial", "Juge arbitre", "Tous"].map(role => {
              const sel = (form.targets || []).includes(role);
              const colors = { "Alternant": "#8B5CF6", "Responsable com": "#0F56B8", "Directeur d'exploitation": "#1E3A5F", "Commercial": "#10B981", "Juge arbitre": "#F59E0B", "Tous": "#2D2D30" };
              const col = colors[role] || "#6B7280";
              return (
                <button key={role} onClick={() => {
                  if (role === "Tous") {
                    setForm(p => ({ ...p, targets: sel ? [] : ["Tous"] }));
                  } else {
                    setForm(p => ({ ...p, targets: sel ? (p.targets || []).filter(r => r !== role) : [...(p.targets || []).filter(r => r !== "Tous"), role] }));
                  }
                }} style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${sel ? col : "#E2E8F0"}`, background: sel ? col + "12" : "transparent", color: sel ? col : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {sel ? "✓ " : ""}{role}
                </button>
              );
            })}
          </div>
          {(form.targets || []).length === 0 && <div style={{ fontSize: 10, color: "#CBD5E1", marginTop: 6, fontStyle: "italic" }}>Aucun rôle sélectionné — visible par tous les membres par défaut</div>}
        </div>
      </div>)}

      {/* ── OBJECTIFS ── */}
      {formTab === "objectifs" && (<div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>🎯 Objectifs de la campagne</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
          {["Recruter de nouveaux joueurs","Réactiver les anciens clients","Augmenter les abonnements","Développer les ventes boutique","Vendre davantage de cours","Faire découvrir la Carte Club","Augmenter le panier moyen","Créer du trafic en club"].map(obj => {
            const sel = (form.objectives || []).includes(obj);
            return <button key={obj} onClick={() => setForm(p => ({ ...p, objectives: sel ? (p.objectives||[]).filter(o => o !== obj) : [...(p.objectives||[]), obj] }))} style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${sel ? "#0F56B8" : "#E2E8F0"}`, background: sel ? "#0F56B815" : "transparent", color: sel ? "#0F56B8" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{sel ? "✓ " : ""}{obj}</button>;
          })}
        </div>
        {(form.objectives || []).filter(o => !["Recruter de nouveaux joueurs","Réactiver les anciens clients","Augmenter les abonnements","Développer les ventes boutique","Vendre davantage de cours","Faire découvrir la Carte Club","Augmenter le panier moyen","Créer du trafic en club"].includes(o)).map(obj => (
          <div key={obj} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
            <span style={{ padding: "4px 10px", borderRadius: 8, background: "#0F56B815", color: "#0F56B8", fontSize: 11, fontWeight: 600, flex: 1 }}>✓ {obj}</span>
            <button onClick={() => setForm(p => ({ ...p, objectives: (p.objectives||[]).filter(o => o !== obj) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 12 }}>✕</button>
          </div>
        ))}
        <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4, marginTop: 8 }}>Objectif personnalisé</div>
        <div style={{ display: "flex", gap: 4 }}>
          <input
            value={form._customObjInput || ""}
            onChange={e => setForm(p => ({ ...p, _customObjInput: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter" && (form._customObjInput || "").trim()) { setForm(p => ({ ...p, objectives: [...(p.objectives||[]), p._customObjInput.trim()], _customObjInput: "" })); }}}
            placeholder="Ajouter un objectif..."
            style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }}
          />
          <button onClick={() => { if ((form._customObjInput || "").trim()) { setForm(p => ({ ...p, objectives: [...(p.objectives||[]), p._customObjInput.trim()], _customObjInput: "" })); }}} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#0F56B8", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+</button>
        </div>
      </div>)}

      {/* ── CONCEPT ── */}
      {formTab === "concept" && (<div>
        <div style={{ marginBottom: 14, padding: 14, background: "linear-gradient(135deg,#6366F108,#EC489908)", border: "1.5px solid #6366F130", borderRadius: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6366F1", marginBottom: 8 }}>💎 Concept de la campagne</label>
          <textarea value={form.concept} onChange={e => setForm(p => ({ ...p, concept: e.target.value }))} rows={5} placeholder="Ex: Comme dans une rentrée scolaire, chacun prépare sa saison. Chez Esprit Padel, on prépare sa saison avec sa raquette, son sac, sa tenue..." style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #6366F130", fontSize: 12, fontFamily: "inherit", resize: "vertical", background: "transparent", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>✍️ Signature(s) de la campagne</label>
          <textarea value={form.signature} onChange={e => setForm(p => ({ ...p, signature: e.target.value }))} rows={3} placeholder={"La rentrée, ça se prépare. Votre saison aussi.\nou\nVotre meilleure saison commence aujourd'hui."} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
        </div>
        <Input label="# Hashtags" value={form.hashtags} onChange={v => setForm(p => ({ ...p, hashtags: v }))} placeholder="#BackToPadel #EspritPadel #Padel" />
      </div>)}

      {/* ── OFFRE COMMERCIALE ── */}
      {formTab === "offre" && (<div>
        {/* Packs */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#2D2D30" }}>📦 Packs</label>
            <button onClick={() => setForm(p => ({ ...p, packs: [...(p.packs||[]), { id: uid(), name: "", items: [""] }] }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#0F56B8", fontWeight: 600, fontFamily: "inherit" }}>+ Ajouter un pack</button>
          </div>
          {(form.packs||[]).map((pack, pi) => (
            <div key={pack.id} style={{ padding: 14, background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0", marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <input value={pack.name} onChange={e => setForm(p => ({ ...p, packs: p.packs.map((pk, i) => i === pi ? { ...pk, name: e.target.value } : pk) }))} placeholder="Nom du pack (ex: PACK DÉCOUVERTE)" style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1.5px solid #0F56B830", fontSize: 13, fontFamily: "inherit", fontWeight: 700, background: "#fff" }} />
                <button onClick={() => setForm(p => ({ ...p, packs: p.packs.filter((_, i) => i !== pi) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 14 }}>🗑️</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pack.items.map((item, ii) => (
                  <div key={ii} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <span style={{ color: "#10B981", fontSize: 14, paddingTop: 8, flexShrink: 0 }}>✔️</span>
                    <textarea
                      value={item}
                      onChange={e => setForm(p => ({ ...p, packs: p.packs.map((pk, i) => i === pi ? { ...pk, items: pk.items.map((it, j) => j === ii ? e.target.value : it) } : pk) }))}
                      placeholder="Décrivez cet élément du pack..."
                      rows={2}
                      style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", resize: "vertical", lineHeight: 1.5, background: "#fff" }}
                    />
                    <button onClick={() => setForm(p => ({ ...p, packs: p.packs.map((pk, i) => i === pi ? { ...pk, items: pk.items.filter((_, j) => j !== ii) } : pk) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 12, paddingTop: 8, flexShrink: 0 }}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setForm(p => ({ ...p, packs: p.packs.map((pk, i) => i === pi ? { ...pk, items: [...pk.items, ""] } : pk) }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#0F56B8", fontWeight: 600, fontFamily: "inherit", marginTop: 8 }}>+ Ajouter un élément</button>
            </div>
          ))}
          {(form.packs||[]).length === 0 && <div style={{ fontSize: 11, color: "#CBD5E1", fontStyle: "italic" }}>Aucun pack. Cliquez sur "+ Ajouter un pack" pour commencer.</div>}
        </div>

        {/* Produits boutique */}
        <Textarea label="🛍️ Produits boutique à mettre en avant" value={form.products} onChange={v => setForm(p => ({ ...p, products: v }))} rows={4} placeholder={"Textile (nouvelle collection, sweat, t-shirt, casquette)\nRaquettes : débutant / intermédiaire / confirmé\nSacs — créer des combos\nBalles — ne commencez pas avec des balles usées"} />
        <Textarea label="💳 Carte Club (bonus, paliers de rechargement...)" value={form.carteClub} onChange={v => setForm(p => ({ ...p, carteClub: v }))} rows={3} placeholder={"100€ crédités = 10€ offerts\n200€ = 25€ offerts\n300€ = 50€ offerts"} />
        <Textarea label="📅 Abonnements (avantages, économies...)" value={form.abonnements} onChange={v => setForm(p => ({ ...p, abonnements: v }))} rows={3} placeholder="Insister sur : économies, priorité de réservation, avantages..." />
        <Textarea label="📦 Packs de cours" value={form.cours} onChange={v => setForm(p => ({ ...p, cours: v }))} rows={2} placeholder="5 cours / 10 cours / 20 cours — tarif préférentiel" />
        <Textarea label="👨‍🏫 Cours individuels" value={form.coursIndividuel} onChange={v => setForm(p => ({ ...p, coursIndividuel: v }))} rows={2} placeholder="Cette saison, passez un cap." />
      </div>)}

      {/* ── CANAUX ── */}
      {formTab === "canaux" && (<div>
        <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>📡 Canaux de diffusion</label><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{["Instagram","Facebook","TikTok","LinkedIn","Google Business","Newsletter","WhatsApp","SMS","Affichage","Site web"].map(ch => { const sel = (form.channels||[]).includes(ch); return <button key={ch} onClick={() => setForm(p => ({ ...p, channels: sel ? (p.channels||[]).filter(x => x !== ch) : [...(p.channels||[]), ch] }))} style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${sel ? "#0F56B8" : "#E2E8F0"}`, background: sel ? "#0F56B815" : "transparent", color: sel ? "#0F56B8" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{ch}{sel && " ✓"}</button>; })}</div></div>
        {(form.channels||[]).length > 0 && (
          <div style={{ marginBottom: 14, padding: 12, background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#2D2D30", marginBottom: 8 }}>📝 Détail par canal</label>
            {(form.channels||[]).map(ch => (<div key={ch} style={{ marginBottom: 8 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#0F56B8", marginBottom: 3 }}>{ch}</div><textarea value={(form.channelNotes||{})[ch]||""} onChange={e => setForm(p => ({ ...p, channelNotes: { ...(p.channelNotes||{}), [ch]: e.target.value } }))} placeholder={`Contenu prévu sur ${ch}...`} rows={2} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 11, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} /></div>))}
          </div>
        )}

        {/* WhatsApp messages */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#25D366" }}>💬 Messages WhatsApp</label>
            <button onClick={() => setForm(p => ({ ...p, whatsappMessages: [...(p.whatsappMessages||[]), { id: uid(), date: "", time: "12:00", target: "Tous les adhérents", text: "" }] }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#25D366", fontWeight: 600, fontFamily: "inherit" }}>+ Ajouter</button>
          </div>
          {(form.whatsappMessages||[]).map((msg, mi) => (
            <div key={msg.id} style={{ padding: 12, background: "#F0FDF4", borderRadius: 10, border: "1px solid #25D36630", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input type="date" value={msg.date} onChange={e => setForm(p => ({ ...p, whatsappMessages: p.whatsappMessages.map((m, i) => i === mi ? { ...m, date: e.target.value } : m) }))} style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }} />
                <input type="time" value={msg.time} onChange={e => setForm(p => ({ ...p, whatsappMessages: p.whatsappMessages.map((m, i) => i === mi ? { ...m, time: e.target.value } : m) }))} style={{ width: 80, padding: "5px 8px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }} />
                <input value={msg.target} onChange={e => setForm(p => ({ ...p, whatsappMessages: p.whatsappMessages.map((m, i) => i === mi ? { ...m, target: e.target.value } : m) }))} placeholder="Cible..." style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }} />
                <button onClick={() => setForm(p => ({ ...p, whatsappMessages: p.whatsappMessages.filter((_, i) => i !== mi) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 11 }}>🗑️</button>
              </div>
              <textarea value={msg.text} onChange={e => setForm(p => ({ ...p, whatsappMessages: p.whatsappMessages.map((m, i) => i === mi ? { ...m, text: e.target.value } : m) }))} placeholder="Texte du message WhatsApp..." rows={4} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
            </div>
          ))}
        </div>

        {/* Notifications */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B" }}>🔔 Notifications mobiles</label>
            <button onClick={() => setForm(p => ({ ...p, notifications: [...(p.notifications||[]), { id: uid(), date: "", time: "10:00", title: "", body: "", link: "" }] }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#F59E0B", fontWeight: 600, fontFamily: "inherit" }}>+ Ajouter</button>
          </div>
          {(form.notifications||[]).map((notif, ni) => (
            <div key={notif.id} style={{ padding: 12, background: "#FFFBEB", borderRadius: 10, border: "1px solid #F59E0B30", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input type="date" value={notif.date} onChange={e => setForm(p => ({ ...p, notifications: p.notifications.map((n, i) => i === ni ? { ...n, date: e.target.value } : n) }))} style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }} />
                <input type="time" value={notif.time} onChange={e => setForm(p => ({ ...p, notifications: p.notifications.map((n, i) => i === ni ? { ...n, time: e.target.value } : n) }))} style={{ width: 80, padding: "5px 8px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }} />
                <button onClick={() => setForm(p => ({ ...p, notifications: p.notifications.filter((_, i) => i !== ni) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 11 }}>🗑️</button>
              </div>
              <input value={notif.title} onChange={e => setForm(p => ({ ...p, notifications: p.notifications.map((n, i) => i === ni ? { ...n, title: e.target.value } : n) }))} placeholder="Titre (court, accrocheur)" style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit", fontWeight: 700, marginBottom: 5, boxSizing: "border-box" }} />
              <textarea value={notif.body} onChange={e => setForm(p => ({ ...p, notifications: p.notifications.map((n, i) => i === ni ? { ...n, body: e.target.value } : n) }))} placeholder="Corps de la notification..." rows={2} style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit", resize: "none", boxSizing: "border-box", marginBottom: 5 }} />
              <input value={notif.link} onChange={e => setForm(p => ({ ...p, notifications: p.notifications.map((n, i) => i === ni ? { ...n, link: e.target.value } : n) }))} placeholder="Lien de redirection..." style={{ width: "100%", padding: "5px 10px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
          ))}
        </div>

        {/* Links */}
        <div style={{ marginBottom: 14, padding: 14, background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#2D2D30", marginBottom: 4 }}>🔗 Liens utiles</div>
          <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 10 }}>L'admin définit les intitulés · Les alternants de chaque club renseignent le lien correspondant.</div>

          {/* Admin defines link labels */}
          {isAdmin && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280" }}>Intitulés (admin)</div>
                <button onClick={() => setForm(p => ({ ...p, links: [...(p.links||[]), { id: uid(), label: "", urls: {} }] }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#0F56B8", fontWeight: 600, fontFamily: "inherit" }}>+ Ajouter un intitulé</button>
              </div>
              {(form.links||[]).map(l => (
                <div key={l.id} style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
                  <span style={{ fontSize: 13 }}>🔗</span>
                  <input value={l.label} onChange={e => setForm(p => ({ ...p, links: p.links.map(x => x.id === l.id ? { ...x, label: e.target.value } : x) }))} placeholder="Ex: Lien de réservation terrains, Page Instagram, Fiche Google..." style={{ flex: 1, padding: "6px 10px", borderRadius: 7, border: "1.5px solid #0F56B820", fontSize: 11, fontFamily: "inherit", fontWeight: 600 }} />
                  <button onClick={() => setForm(p => ({ ...p, links: p.links.filter(x => x.id !== l.id) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 12, flexShrink: 0 }}>✕</button>
                </div>
              ))}
              {(form.links||[]).length === 0 && <div style={{ fontSize: 10, color: "#CBD5E1", fontStyle: "italic" }}>Aucun intitulé — cliquez sur "+ Ajouter un intitulé"</div>}
            </div>
          )}

          {/* Per-club URL fields */}
          {(form.links||[]).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>URLs par club</div>
              {physicalClubs.map(club => (
                <div key={club.id} style={{ marginBottom: 10, padding: "8px 10px", background: (club.color||"#0F56B8") + "08", borderRadius: 8, border: `1px solid ${club.color||"#0F56B8"}20` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: club.color || "#0F56B8", marginBottom: 6 }}>🏢 {club.name}</div>
                  {(form.links||[]).map(l => (
                    <div key={l.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#2D2D30", width: 160, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.label || "—"}</span>
                      <input
                        value={((l.urls||{})[String(club.id)])||""}
                        onChange={e => setForm(p => ({ ...p, links: p.links.map(x => x.id === l.id ? { ...x, urls: { ...(x.urls||{}), [String(club.id)]: e.target.value } } : x) }))}
                        placeholder="https://..."
                        style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>)}

      {/* ── PLANNING ── */}
      {formTab === "planning" && (<div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#2D2D30", marginBottom: 6 }}>📅 Planning / Rétroplanning</div>
        <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 12 }}>Pour chaque action, définissez qui en est responsable.</div>
        {["Avant","Pendant","Après"].map(phase => {
          const phaseItems = (form.timeline||[]).filter(t => t.phase === phase);
          const phaseColor = phase === "Avant" ? "#6366F1" : phase === "Pendant" ? "#F59E0B" : "#10B981";
          const ROLES = ["Alternant","Responsable com","Directeur d'exploitation","Commercial","Juge arbitre"];
          const roleColors = { "Alternant":"#8B5CF6","Responsable com":"#0F56B8","Directeur d'exploitation":"#1E3A5F","Commercial":"#10B981","Juge arbitre":"#F59E0B" };
          return (<div key={phase} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: phaseColor, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: phaseColor, display: "inline-block" }} /> {phase}
              <button onClick={() => setForm(p => ({ ...p, timeline: [...(p.timeline||[]), { id: uid(), phase, label: "", date: "", done: false, assignees: [] }] }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: phaseColor, fontWeight: 600, fontFamily: "inherit", marginLeft: "auto" }}>+ Ajouter</button>
            </div>
            {phaseItems.map(t => (
              <div key={t.id} style={{ marginBottom: 8, padding: "10px 12px", background: "#FAFBFC", borderRadius: 10, border: `1px solid ${phaseColor}20` }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                  <input type="checkbox" checked={!!t.done} onChange={() => setForm(p => ({ ...p, timeline: (p.timeline||[]).map(x => x.id === t.id ? { ...x, done: !x.done } : x) }))} style={{ accentColor: phaseColor, flexShrink: 0 }} />
                  <input value={t.label} onChange={e => setForm(p => ({ ...p, timeline: (p.timeline||[]).map(x => x.id === t.id ? { ...x, label: e.target.value } : x) }))} placeholder="Action..." style={{ flex: 1, padding: "6px 10px", borderRadius: 7, border: `1px solid ${phaseColor}30`, fontSize: 11, fontFamily: "inherit", textDecoration: t.done ? "line-through" : "none" }} />
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <select
                      value={["Quotidien","3 fois/semaine","Chaque semaine","En continu","Selon besoin"].includes(t.date) ? t.date : t.date && t.date.includes("|") ? "period" : t.date ? "date" : ""}
                      onChange={e => {
                        const v = e.target.value;
                        if (v === "date") setForm(p => ({ ...p, timeline: (p.timeline||[]).map(x => x.id === t.id ? { ...x, date: new Date().toISOString().split("T")[0] } : x) }));
                        else if (v === "period") setForm(p => ({ ...p, timeline: (p.timeline||[]).map(x => x.id === t.id ? { ...x, date: `${new Date().toISOString().split("T")[0]}|${new Date().toISOString().split("T")[0]}` } : x) }));
                        else setForm(p => ({ ...p, timeline: (p.timeline||[]).map(x => x.id === t.id ? { ...x, date: v } : x) }));
                      }}
                      style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 10, fontFamily: "inherit", background: "#fff", color: "#2D2D30", maxWidth: 130 }}
                    >
                      <option value="">Quand ?</option>
                      <option value="Quotidien">📅 Quotidien</option>
                      <option value="3 fois/semaine">📅 3 fois/semaine</option>
                      <option value="Chaque semaine">📅 Chaque semaine</option>
                      <option value="En continu">🔄 En continu</option>
                      <option value="Selon besoin">⚡ Selon besoin</option>
                      <option value="date">📆 Date précise</option>
                      <option value="period">📆 Entre deux dates</option>
                    </select>
                    {t.date && !["Quotidien","3 fois/semaine","Chaque semaine","En continu","Selon besoin","date","period",""].includes(t.date) && !t.date.includes("|") && (
                      <input type="date" value={t.date} onChange={e => setForm(p => ({ ...p, timeline: (p.timeline||[]).map(x => x.id === t.id ? { ...x, date: e.target.value } : x) }))} style={{ marginTop: 4, width: 130, padding: "4px 6px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 10, fontFamily: "inherit", display: "block" }} />
                    )}
                    {t.date && t.date.includes("|") && (
                      <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                        <input type="date" value={t.date.split("|")[0]} onChange={e => setForm(p => ({ ...p, timeline: (p.timeline||[]).map(x => x.id === t.id ? { ...x, date: `${e.target.value}|${t.date.split("|")[1]}` } : x) }))} style={{ flex: 1, padding: "3px 5px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 9, fontFamily: "inherit" }} />
                        <span style={{ fontSize: 9, color: "#94A3B8", paddingTop: 5 }}>→</span>
                        <input type="date" value={t.date.split("|")[1]} onChange={e => setForm(p => ({ ...p, timeline: (p.timeline||[]).map(x => x.id === t.id ? { ...x, date: `${t.date.split("|")[0]}|${e.target.value}` } : x) }))} style={{ flex: 1, padding: "3px 5px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 9, fontFamily: "inherit" }} />
                      </div>
                    )}
                  </div>
                  <button onClick={() => setForm(p => ({ ...p, timeline: (p.timeline||[]).filter(x => x.id !== t.id) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 11, flexShrink: 0 }}>✕</button>
                </div>
                {/* Assignees */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", paddingLeft: 22 }}>
                  <span style={{ fontSize: 10, color: "#94A3B8", paddingTop: 3 }}>👤</span>
                  {ROLES.map(role => {
                    const sel = (t.assignees || []).includes(role);
                    const col = roleColors[role] || "#6B7280";
                    return (
                      <button key={role} onClick={() => setForm(p => ({ ...p, timeline: (p.timeline||[]).map(x => x.id === t.id ? { ...x, assignees: sel ? (x.assignees||[]).filter(r => r !== role) : [...(x.assignees||[]), role] } : x) }))} style={{ padding: "2px 8px", borderRadius: 6, border: `1.5px solid ${sel ? col : "#E2E8F0"}`, background: sel ? col : "transparent", color: sel ? "#fff" : "#94A3B8", fontSize: 9, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{role}</button>
                    );
                  })}
                </div>
              </div>
            ))}
            {phaseItems.length === 0 && <div style={{ fontSize: 10, color: "#CBD5E1", fontStyle: "italic", paddingLeft: 8 }}>Aucune action — cliquez sur "+ Ajouter"</div>}
          </div>);
        })}

        {/* Liens vers les visuels */}
        <div style={{ marginBottom: 14, padding: 12, background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#2D2D30" }}>🖼️ Liens vers les visuels</label>
            <button onClick={() => setForm(p => ({ ...p, visualLinks: [...(p.visualLinks||[]), { id: uid(), label: "", url: "" }] }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#0F56B8", fontWeight: 600, fontFamily: "inherit" }}>+ Ajouter un lien</button>
          </div>
          <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 8 }}>Partagez ici les liens vers les dossiers Google Drive, Canva, Dropbox... contenant les visuels à utiliser.</div>
          {(form.visualLinks||[]).length === 0 && <div style={{ fontSize: 10, color: "#CBD5E1", fontStyle: "italic" }}>Aucun lien — cliquez sur "+ Ajouter un lien"</div>}
          {(form.visualLinks||[]).map(vl => (
            <div key={vl.id} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
              <input value={vl.label} onChange={e => setForm(p => ({ ...p, visualLinks: (p.visualLinks||[]).map(x => x.id === vl.id ? { ...x, label: e.target.value } : x) }))} placeholder="Nom (ex: Kit Back to Padel – Canva)" style={{ flex: "0 0 200px", padding: "6px 8px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }} />
              <input value={vl.url} onChange={e => setForm(p => ({ ...p, visualLinks: (p.visualLinks||[]).map(x => x.id === vl.id ? { ...x, url: e.target.value } : x) }))} placeholder="https://..." style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }} />
              <button onClick={() => setForm(p => ({ ...p, visualLinks: (p.visualLinks||[]).filter(x => x.id !== vl.id) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 11 }}>✕</button>
            </div>
          ))}
        </div>

        {/* Export ICS */}
        <div style={{ marginBottom: 14, padding: 12, background: "#F0F9FF", borderRadius: 10, border: "1px solid #0F56B830", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0F56B8" }}>📅 Exporter vers le calendrier iPhone</div>
            <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>Télécharge un fichier .ics — ouvrez-le sur votre iPhone pour ajouter toutes les dates au Calendrier Apple.</div>
          </div>
          <button onClick={() => {
            const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Esprit Padel//Campagne//FR","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
            (form.timeline||[]).filter(t => t.date && !t.date.includes("|") && !["Quotidien","3 fois/semaine","Chaque semaine","En continu","Selon besoin"].includes(t.date)).forEach(t => {
              const d = t.date.replace(/-/g,"");
              const now = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
              const assignees = (t.assignees||[]).join(", ");
              lines.push("BEGIN:VEVENT",`UID:${t.id}@espritpadel`,`DTSTAMP:${now}`,`DTSTART;VALUE=DATE:${d}`,`DTEND;VALUE=DATE:${d}`,`SUMMARY:${(t.label||"Action").replace(/,/g,"\\,")} [${t.phase}]`,assignees ? `DESCRIPTION:${assignees}` : "DESCRIPTION:",`CATEGORIES:${t.phase}`,"END:VEVENT");
            });
            (form.whatsappMessages||[]).filter(m => m.date).forEach(m => {
              const d = m.date.replace(/-/g,"");
              const now = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
              lines.push("BEGIN:VEVENT",`UID:wa-${m.id}@espritpadel`,`DTSTAMP:${now}`,`DTSTART;VALUE=DATE:${d}`,`DTEND;VALUE=DATE:${d}`,`SUMMARY:💬 WhatsApp ${m.time||""} – ${(m.target||"").slice(0,30)}`,`DESCRIPTION:${(m.text||"").slice(0,80).replace(/\n/g,"\\n")}...`,"END:VEVENT");
            });
            (form.notifications||[]).filter(n => n.date).forEach(n => {
              const d = n.date.replace(/-/g,"");
              const now = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
              lines.push("BEGIN:VEVENT",`UID:notif-${n.id}@espritpadel`,`DTSTAMP:${now}`,`DTSTART;VALUE=DATE:${d}`,`DTEND;VALUE=DATE:${d}`,`SUMMARY:🔔 Notif ${n.time||""} – ${(n.title||"").slice(0,40)}`,`DESCRIPTION:${(n.body||"").slice(0,80).replace(/\n/g,"\\n")}`,"END:VEVENT");
            });
            lines.push("END:VCALENDAR");
            const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `${(form.name||"Campagne").replace(/[^a-zA-Z0-9]/g,"_")}.ics`; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 3000);
          }} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#0F56B8", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>📅 Télécharger .ics</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>📷 Visuels à prévoir</label>
            <button onClick={() => setForm(p => ({ ...p, visualsTodo: [...(p.visualsTodo||[]), { id: uid(), label: "", done: false }] }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#0F56B8", fontWeight: 600, fontFamily: "inherit" }}>+ Ajouter</button>
          </div>
          {(form.visualsTodo||[]).map(v => (<div key={v.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}><input type="checkbox" checked={!!v.done} onChange={() => setForm(p => ({ ...p, visualsTodo: p.visualsTodo.map(x => x.id === v.id ? { ...x, done: !x.done } : x) }))} style={{ accentColor: "#10B981" }} /><input value={v.label} onChange={e => setForm(p => ({ ...p, visualsTodo: p.visualsTodo.map(x => x.id === v.id ? { ...x, label: e.target.value } : x) }))} placeholder="Ex: Photos cours enfants" style={{ flex: 1, padding: "4px 8px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }} /><button onClick={() => setForm(p => ({ ...p, visualsTodo: p.visualsTodo.filter(x => x.id !== v.id) }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#EF4444" }}>✕</button></div>))}
        </div>
      </div>)}

      {/* ── KPI ── */}
      {formTab === "kpi" && (<div>
        <div style={{ padding: 12, background: "linear-gradient(135deg,#0F56B808,#10B98108)", borderRadius: 10, border: "1px solid #0F56B820", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30" }}>📊 KPI par club — Avant / Après</div>
          <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
            Les <strong>alternants</strong> renseignent les valeurs <span style={{ color: "#6366F1", fontWeight: 700 }}>Avant</span> · L'<strong>admin</strong> complète les valeurs <span style={{ color: "#10B981", fontWeight: 700 }}>Après</span>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#2D2D30" }}>1️⃣ Indicateurs à suivre</div>
            <button onClick={() => setForm(p => ({ ...p, kpiIndicators: [...(p.kpiIndicators||[]), { id: uid(), label: "", unite: "" }] }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#0F56B8", fontWeight: 600, fontFamily: "inherit" }}>+ Personnalisé</button>
          </div>
          {[
            ["Réseaux sociaux", ["Abonnés Instagram","Abonnés Facebook","Abonnés TikTok","Portée totale","Engagement rate (%)","Reels vues","Stories vues"]],
            ["Commercial", ["Nouveaux abonnements","Recharges Carte Club","Cours vendus","Packs de cours","Ventes boutique (€)","Réservations terrain"]],
            ["Club", ["Nouveaux adhérents","Taux de réactivation (%)","Fréquentation club","Panier moyen (€)"]],
          ].map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>{cat}</div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {items.map(label => {
                  const already = (form.kpiIndicators||[]).some(k => k.label === label);
                  return (
                    <button key={label} onClick={() => { if (!already) setForm(p => ({ ...p, kpiIndicators: [...(p.kpiIndicators||[]), { id: uid(), label, unite: "" }] })); }}
                      style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${already ? "#10B981" : "#E2E8F0"}`, background: already ? "#10B98115" : "#F8FAFC", color: already ? "#10B981" : "#6B7280", fontSize: 10, cursor: already ? "default" : "pointer", fontFamily: "inherit", fontWeight: already ? 700 : 400 }}>
                      {already ? "✓ " : "+ "}{label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {(form.kpiIndicators||[]).map((k, ki) => (
            <div key={k.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, marginTop: ki === 0 ? 8 : 0 }}>
              <input value={k.label} onChange={e => setForm(p => ({ ...p, kpiIndicators: (p.kpiIndicators||[]).map((x, i) => i === ki ? { ...x, label: e.target.value } : x) }))} placeholder="Nom de l'indicateur..." style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }} />
              <input value={k.unite} onChange={e => setForm(p => ({ ...p, kpiIndicators: (p.kpiIndicators||[]).map((x, i) => i === ki ? { ...x, unite: e.target.value } : x) }))} placeholder="€, %, nb..." style={{ width: 70, padding: "5px 8px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }} />
              <button onClick={() => setForm(p => ({ ...p, kpiIndicators: (p.kpiIndicators||[]).filter((_, i) => i !== ki) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 11 }}>✕</button>
            </div>
          ))}
          {(form.kpiIndicators||[]).length === 0 && <div style={{ fontSize: 10, color: "#CBD5E1", fontStyle: "italic", marginTop: 6 }}>Sélectionnez des indicateurs ci-dessus ou cliquez "+ Personnalisé"</div>}
        </div>

        {(form.kpiIndicators||[]).length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#2D2D30", marginBottom: 10 }}>2️⃣ Valeurs par club</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#6B7280", borderBottom: "2px solid #E2E8F0", minWidth: 160, background: "#FAFBFC" }}>Indicateur</th>
                    {physicalClubs.map(club => (
                      <th key={club.id} colSpan={2} style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: club.color || "#0F56B8", borderBottom: "2px solid #E2E8F0", borderLeft: "2px solid #E2E8F0", background: (club.color || "#0F56B8") + "08", minWidth: 160 }}>🏢 {club.name}</th>
                    ))}
                  </tr>
                  <tr>
                    <th style={{ padding: "5px 12px", background: "#FAFBFC", borderBottom: "1px solid #F1F5F9" }}></th>
                    {physicalClubs.map(club => (
                      <React.Fragment key={club.id}>
                        <th style={{ padding: "5px 8px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "#6366F1", borderBottom: "1px solid #F1F5F9", borderLeft: "2px solid #E2E8F0", background: "#6366F108", width: 80 }}>
                          📅 Avant<div style={{ fontSize: 8, color: "#8B5CF6", fontWeight: 400 }}>Alternant</div>
                        </th>
                        <th style={{ padding: "5px 8px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "#10B981", borderBottom: "1px solid #F1F5F9", background: "#10B98108", width: 80 }}>
                          ✅ Après<div style={{ fontSize: 8, color: "#10B981", fontWeight: 400 }}>{isAdmin ? "Admin" : "—"}</div>
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(form.kpiIndicators||[]).map(k => (
                    <tr key={k.id} style={{ borderBottom: "1px solid #F4F2EF" }}>
                      <td style={{ padding: "7px 12px", fontWeight: 600, color: "#2D2D30", background: "#FAFBFC" }}>
                        {k.label}{k.unite && <span style={{ color: "#94A3B8", fontWeight: 400 }}> ({k.unite})</span>}
                      </td>
                      {physicalClubs.map(club => {
                        const cid = String(club.id);
                        const vals = ((form.kpiValues||{})[cid]||{})[k.id] || { avant: "", apres: "" };
                        const av = parseFloat(vals.avant);
                        const ap = parseFloat(vals.apres);
                        const diff = vals.avant !== "" && vals.apres !== "" && !isNaN(av) && !isNaN(ap) ? ap - av : null;
                        const pct = diff !== null && av !== 0 ? Math.round((diff / av) * 100) : null;
                        const upd = (field, val) => setForm(p => {
                          const kv = JSON.parse(JSON.stringify(p.kpiValues || {}));
                          if (!kv[cid]) kv[cid] = {};
                          if (!kv[cid][k.id]) kv[cid][k.id] = { avant: "", apres: "" };
                          kv[cid][k.id][field] = val;
                          return { ...p, kpiValues: kv };
                        });
                        return (
                          <React.Fragment key={club.id}>
                            <td style={{ padding: "5px 6px", borderLeft: "2px solid #E2E8F0", background: "#6366F104" }}>
                              <input type="number" value={vals.avant} onChange={e => upd("avant", e.target.value)} placeholder="0"
                                style={{ width: "100%", padding: "4px 6px", borderRadius: 5, border: "1px solid #6366F130", background: "transparent", fontSize: 11, fontFamily: "inherit", textAlign: "center" }} />
                            </td>
                            <td style={{ padding: "5px 6px", background: "#10B98104" }}>
                              <input type="number" value={vals.apres} onChange={e => upd("apres", e.target.value)} placeholder="0"
                                disabled={!isAdmin}
                                style={{ width: "100%", padding: "4px 6px", borderRadius: 5, border: "1px solid #10B98130", background: "transparent", fontSize: 11, fontFamily: "inherit", textAlign: "center", cursor: isAdmin ? "text" : "not-allowed", opacity: isAdmin ? 1 : 0.4 }} />
                              {diff !== null && (
                                <div style={{ fontSize: 9, fontWeight: 700, color: diff > 0 ? "#10B981" : "#EF4444", textAlign: "center", marginTop: 2 }}>
                                  {diff > 0 ? "▲+" : "▼"}{diff}{pct !== null ? ` (${diff > 0 ? "+" : ""}${pct}%)` : ""}
                                </div>
                              )}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>)}

      {/* ── PRÉSENTATION ── */}
      {formTab === "presentation" && (<div>
        <div style={{ padding: 12, background: "linear-gradient(135deg,#FEB60108,#0F56B808)", borderRadius: 10, border: "1px solid #FEB60130", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30" }}>📣 Présentation de la campagne</div>
          <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>Ce texte sera affiché aux alternants et équipes pour présenter la campagne en détail.</div>
        </div>
        <Textarea label="Texte de présentation (contexte, enjeux, instructions)" value={form.presentation || ""} onChange={v => setForm(p => ({ ...p, presentation: v }))} rows={12} placeholder={"Exemple :\n\nLa campagne Back to Padel marque le lancement de la nouvelle saison chez Esprit Padel...\n\nVos missions :\n- Publier les contenus prévus dans le planning\n- Réaliser au minimum 3 stories par jour\n- Faire remonter les ventes chaque semaine\n- Prévenir Mélissa en cas de rupture de stock ou changement d'offre\n\nConsignes importantes :\n- Aucune remise commerciale sans validation de la direction\n- Utiliser les visuels du kit graphique uniquement\n- Respecter les dates et heures de publication"} />
      </div>)}

      <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 14, marginTop: 4 }}>
        <Btn onClick={save}>{editing ? "Enregistrer" : "Créer la campagne"}</Btn>
      </div>
    </Modal>

  </div>);
}

// ==================== SONDAGES (Surveys) ====================
const QUESTION_TYPES = [
  { id: "text", label: "📝 Réponse libre", icon: "📝" },
  { id: "single", label: "🔘 Choix unique", icon: "🔘" },
  { id: "multi", label: "☑️ Choix multiples", icon: "☑️" },
  { id: "scale", label: "🎚️ Curseur 1-10", icon: "🎚️" },
];

function getSurveyPublicUrl(surveyId) {
  const base = window.location.origin + window.location.pathname;
  return `${base}?sondage=${surveyId}`;
}

function SurveysPage({ surveys, setSurveys, surveyResponses, setSurveyResponses, clubs, users, isAdmin, isDirector, currentUser, currentUserId, addToast }) {
  const [tab, setTab] = useState("list"); // list | results
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [qrModal, setQrModal] = useState(null); // surveyId
  const [flyerModal, setFlyerModal] = useState(null); // surveyId
  const [resultsSurvey, setResultsSurvey] = useState(null);
  const [resultsFilter, setResultsFilter] = useState("all"); // all | named
  const [form, setForm] = useState({
    title: "", description: "", club: "", anonymous: true,
    primaryColor: "#0F56B8", customLogo: "",
    questions: [{ id: uid(), type: "text", label: "", options: [] }]
  });
  const [logoUploading, setLogoUploading] = useState(false);

  const directorClubIds = (currentUser?.clubs || []).map(String);
  const userClubIds = (currentUser?.clubs || []).map(String);
  const myClubs = isAdmin ? clubs : clubs.filter(c => userClubIds.includes(String(c.id)));
  const mySurveys = isAdmin ? surveys : surveys.filter(s => userClubIds.includes(String(s.club)) || String(s.owner) === String(currentUserId));

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", club: String(myClubs[0]?.id || ""), anonymous: true, primaryColor: "#0F56B8", customLogo: "", questions: [{ id: uid(), type: "text", label: "", options: [] }] });
    setModalOpen(true);
  };
  const openEdit = (s) => { setEditing(s.id); setForm({ ...s }); setModalOpen(true); };

  const addQuestion = () => setForm(p => ({ ...p, questions: [...p.questions, { id: uid(), type: "text", label: "", options: [] }] }));
  const updateQuestion = (qid, field, val) => setForm(p => ({ ...p, questions: p.questions.map(q => q.id === qid ? { ...q, [field]: val } : q) }));
  const delQuestion = (qid) => setForm(p => ({ ...p, questions: p.questions.filter(q => q.id !== qid) }));
  const addOption = (qid) => setForm(p => ({ ...p, questions: p.questions.map(q => q.id === qid ? { ...q, options: [...(q.options || []), ""] } : q) }));
  const updateOption = (qid, idx, val) => setForm(p => ({ ...p, questions: p.questions.map(q => q.id === qid ? { ...q, options: q.options.map((o, i) => i === idx ? val : o) } : q) }));
  const delOption = (qid, idx) => setForm(p => ({ ...p, questions: p.questions.map(q => q.id === qid ? { ...q, options: q.options.filter((_, i) => i !== idx) } : q) }));

  const save = () => {
    if (!form.title || !form.club) return;
    const cleanQuestions = form.questions.filter(q => q.label && q.label.trim());
    if (cleanQuestions.length === 0) { alert("Ajoutez au moins une question avec un intitulé."); return; }
    if (editing) {
      setSurveys(p => p.map(s => String(s.id) === String(editing) ? { ...s, ...form, questions: cleanQuestions } : s));
      addToast({ title: `📊 Sondage modifié : ${form.title}`, icon: "📊" });
    } else {
      const newId = uid();
      setSurveys(p => [...p, { id: newId, ...form, questions: cleanQuestions, owner: currentUserId, active: true, createdAt: new Date().toISOString() }]);
      addToast({ title: `📊 Sondage créé : ${form.title}`, icon: "📊" });
    }
    setModalOpen(false);
  };

  const delSurvey = (id) => { if (!window.confirm("Supprimer ce sondage et toutes ses réponses ?")) return; setSurveys(p => p.filter(s => String(s.id) !== String(id))); setSurveyResponses(p => p.filter(r => String(r.surveyId) !== String(id))); };
  const toggleActive = (id) => setSurveys(p => p.map(s => String(s.id) === String(id) ? { ...s, active: !s.active } : s));

  const getClubName = (id) => clubs.find(c => String(c.id) === String(id))?.name || "—";
  const getResponses = (surveyId) => surveyResponses.filter(r => String(r.surveyId) === String(surveyId));

  const copyLink = (surveyId) => { navigator.clipboard.writeText(getSurveyPublicUrl(surveyId)); addToast({ title: "🔗 Lien copié !", icon: "🔗" }); };

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
      <div><h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>📊 Sondages</h2><div style={{ fontSize: 12, color: "#6B7280" }}>{mySurveys.length} sondage(s)</div></div>
      <Btn onClick={openNew}>+ Nouveau sondage</Btn>
    </div>

    {!resultsSurvey ? (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {mySurveys.map(s => {
          const responses = getResponses(s.id);
          return (<Card key={s.id} style={{ padding: 16, borderLeft: `4px solid ${s.active ? "#10B981" : "#94A3B8"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30" }}>{s.title}</div>
                <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>🏢 {getClubName(s.club)} · {s.anonymous ? "🔒 Privé" : "👤 Nominatif"}</div>
              </div>
              <span style={{ padding: "2px 8px", borderRadius: 6, background: s.active ? "#10B98115" : "#94A3B815", color: s.active ? "#10B981" : "#94A3B8", fontSize: 10, fontWeight: 700 }}>{s.active ? "Actif" : "Fermé"}</span>
            </div>
            {s.description && <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 8, lineHeight: 1.5 }}>{s.description}</div>}
            <div style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 11, color: "#6B7280" }}>
              <span>📋 {s.questions.length} question(s)</span>
              <span>💬 {responses.length} réponse(s)</span>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button onClick={() => setQrModal(s.id)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "#0F56B815", color: "#0F56B8", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📱 QR Code</button>
              <button onClick={() => setFlyerModal(s.id)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "#EC489915", color: "#EC4899", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📄 Flyer PDF</button>
              <button onClick={() => copyLink(s.id)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "#6366F115", color: "#6366F1", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🔗 Copier lien</button>
              <button onClick={() => setResultsSurvey(s.id)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "#10B98115", color: "#10B981", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📊 Résultats</button>
              <button onClick={() => toggleActive(s.id)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "#F1F5F9", color: "#6B7280", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{s.active ? "⏸ Fermer" : "▶ Réactiver"}</button>
              <button onClick={() => openEdit(s)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "#F1F5F9", color: "#6B7280", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✏️</button>
              <button onClick={() => delSurvey(s.id)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "#FEE2E2", color: "#EF4444", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
            </div>
          </Card>);
        })}
        {mySurveys.length === 0 && <Card style={{ padding: 30, textAlign: "center", gridColumn: "1/-1" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📊</div><div style={{ fontSize: 13, color: "#6B7280" }}>Aucun sondage. Créez le premier !</div></Card>}
      </div>
    ) : (
      <SurveyResults survey={surveys.find(s => String(s.id) === String(resultsSurvey))} responses={getResponses(resultsSurvey)} onBack={() => setResultsSurvey(null)} />
    )}

    {/* QR Modal */}
    {qrModal && (() => {
      const survey = surveys.find(s => String(s.id) === String(qrModal));
      const url = getSurveyPublicUrl(qrModal);
      const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=${encodeURIComponent(url)}`;
      return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setQrModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, width: "min(380px, 90vw)", textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{survey?.title}</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 16 }}>Scannez pour répondre au sondage</div>
            <img src={qrImgUrl} alt="QR Code" style={{ width: "100%", maxWidth: 280, borderRadius: 12, border: "1px solid #E2E8F0" }} />
            <div style={{ marginTop: 14, padding: "8px 12px", background: "#F8FAFC", borderRadius: 8, fontSize: 10, color: "#6B7280", wordBreak: "break-all" }}>{url}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <a href={qrImgUrl} download={`QR_${survey?.title || "sondage"}.png`} style={{ flex: 1, padding: "8px", borderRadius: 8, background: "#0F56B8", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>⬇ Télécharger QR</a>
              <button onClick={() => { navigator.clipboard.writeText(url); addToast({ title: "🔗 Lien copié !", icon: "🔗" }); }} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🔗 Copier lien</button>
            </div>
            <button onClick={() => setQrModal(null)} style={{ marginTop: 10, background: "none", border: "none", color: "#94A3B8", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Fermer</button>
          </div>
        </div>
      );
    })()}

    {/* Create/Edit Modal */}
    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier le sondage" : "Nouveau sondage"} wide>
      <Input label="Titre du sondage" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} placeholder="Satisfaction client - Mai 2026" />
      <Textarea label="Description (optionnel)" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} rows={2} />
      <Select label="Club" value={String(form.club)} onChange={v => setForm(p => ({ ...p, club: v }))} options={myClubs.map(c => ({ value: String(c.id), label: c.name }))} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", marginBottom: 14, borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9" }}>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: "#2D2D30" }}>{form.anonymous ? "🔒 Réponses privées (anonymes)" : "👤 Réponses nominatives"}</div><div style={{ fontSize: 10, color: "#94A3B8" }}>{form.anonymous ? "Les répondants ne donnent pas leur identité" : "Les répondants doivent indiquer leur nom"}</div></div>
        <button onClick={() => setForm(p => ({ ...p, anonymous: !p.anonymous }))} style={{ width: 48, height: 26, borderRadius: 13, border: "none", background: form.anonymous ? "#94A3B8" : "#0F56B8", cursor: "pointer", position: "relative", flexShrink: 0 }}><span style={{ position: "absolute", top: 3, left: form.anonymous ? 3 : 24, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} /></button>
      </div>

      {/* Apparence du sondage */}
      <div style={{ marginBottom: 16, padding: 14, background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#2D2D30", marginBottom: 10 }}>🎨 Apparence du questionnaire</div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Couleur principale</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {["#0F56B8", "#10B981", "#EC4899", "#F59E0B", "#6366F1", "#EF4444", "#14B8A6", "#1E3A5F"].map(c => (
              <button key={c} onClick={() => setForm(p => ({ ...p, primaryColor: c }))} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: form.primaryColor === c ? "3px solid #2D2D30" : "2px solid #fff", boxShadow: "0 0 0 1px #E2E8F0", cursor: "pointer" }} />
            ))}
            <input type="color" value={form.primaryColor} onChange={e => setForm(p => ({ ...p, primaryColor: e.target.value }))} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer", overflow: "hidden" }} title="Couleur personnalisée" />
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Logo personnalisé (optionnel)</label>
          {form.customLogo && !form.customLogo.startsWith("data:") && (
            <div style={{ padding: "6px 10px", background: "#FEF2F2", border: "1px solid #EF444430", borderRadius: 8, marginBottom: 8, fontSize: 10, color: "#EF4444" }}>⚠️ Ce logo a été importé avec une ancienne version et ne s'affichera pas correctement. Merci de le réimporter.</div>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {form.customLogo ? (
              <div style={{ position: "relative" }}>
                <img src={form.customLogo} alt="logo" onError={e => { e.target.style.display = "none"; }} style={{ height: 44, maxWidth: 120, objectFit: "contain", borderRadius: 8, border: "1px solid #E2E8F0", padding: 4, background: "#fff" }} />
                <button onClick={() => setForm(p => ({ ...p, customLogo: "" }))} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#EF4444", color: "#fff", border: "none", fontSize: 10, cursor: "pointer", lineHeight: "18px" }}>✕</button>
              </div>
            ) : (
              <img src={LOGO_URI} alt="logo par défaut" style={{ height: 44, maxWidth: 120, objectFit: "contain", borderRadius: 8, border: "1px solid #E2E8F0", padding: 4, background: "#fff", opacity: 0.6 }} />
            )}
            <label style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#6B7280", fontFamily: "inherit" }}>
              {logoUploading ? "⏳ Upload..." : form.customLogo ? "🔄 Changer" : "📷 Importer un logo"}
              <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (!f) return; setLogoUploading(true); const reader = new FileReader(); reader.onload = () => { setForm(p => ({ ...p, customLogo: reader.result })); setLogoUploading(false); }; reader.onerror = () => { alert("Erreur de lecture du fichier."); setLogoUploading(false); }; reader.readAsDataURL(f); }} style={{ display: "none" }} />
            </label>
          </div>
          <div style={{ fontSize: 9, color: "#CBD5E1", marginTop: 4 }}>Sans logo importé, le logo Esprit Padel par défaut sera affiché.</div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30" }}>📋 Questions</label>
          <button onClick={addQuestion} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#0F56B8", fontWeight: 600, fontFamily: "inherit" }}>+ Ajouter une question</button>
        </div>
        {form.questions.map((q, qi) => (
          <Card key={q.id} style={{ padding: 12, marginBottom: 8, background: "#FAFBFC" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>Question {qi + 1}</span>
              <button onClick={() => delQuestion(q.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#EF4444" }}>✕ Supprimer</button>
            </div>
            <input value={q.label} onChange={e => updateQuestion(q.id, "label", e.target.value)} placeholder="Intitulé de la question..." style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
              {QUESTION_TYPES.map(t => <button key={t.id} onClick={() => updateQuestion(q.id, "type", t.id)} style={{ padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${q.type === t.id ? "#0F56B8" : "#E2E8F0"}`, background: q.type === t.id ? "#0F56B815" : "transparent", color: q.type === t.id ? "#0F56B8" : "#6B7280", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t.label}</button>)}
            </div>
            {(q.type === "single" || q.type === "multi") && (
              <div style={{ paddingLeft: 8 }}>
                {(q.options || []).map((opt, oi) => (
                  <div key={oi} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#94A3B8", paddingTop: 6 }}>{q.type === "single" ? "🔘" : "☑️"}</span>
                    <input value={opt} onChange={e => updateOption(q.id, oi, e.target.value)} placeholder={`Option ${oi + 1}`} style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }} />
                    <button onClick={() => delOption(q.id, oi)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#EF4444" }}>✕</button>
                  </div>
                ))}
                <button onClick={() => addOption(q.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#0F56B8", fontWeight: 600, fontFamily: "inherit", marginTop: 2 }}>+ Ajouter une option</button>
              </div>
            )}
            {q.type === "scale" && <div style={{ fontSize: 10, color: "#94A3B8", paddingLeft: 8 }}>Le répondant choisira une note de 1 à 10</div>}
          </Card>
        ))}
      </div>

      <Btn onClick={save}>{editing ? "Enregistrer" : "Créer le sondage"}</Btn>
    </Modal>

    {flyerModal && <FlyerModal survey={surveys.find(s => String(s.id) === String(flyerModal))} onClose={() => setFlyerModal(null)} addToast={addToast} />}
  </div>);
}

function FlyerModal({ survey, onClose, addToast }) {
  const [flyerTitle, setFlyerTitle] = useState(survey?.title || "");
  const [flyerSubtitle, setFlyerSubtitle] = useState(survey?.description || "");
  const [flyerBody, setFlyerBody] = useState("Scannez le QR code ou rendez-vous sur le lien ci-dessous pour répondre à ce questionnaire.");
  const [qrCaption, setQrCaption] = useState("Scannez-moi");
  const [bgPhoto, setBgPhoto] = useState("");
  const [bgOpacity, setBgOpacity] = useState(15);
  const [photoUploading, setPhotoUploading] = useState(false);
  const accent = survey?.primaryColor || "#0F56B8";
  const logo = (survey?.customLogo && survey.customLogo.startsWith("data:")) ? survey.customLogo : LOGO_URI;
  const publicUrl = survey ? getSurveyPublicUrl(survey.id) : "";
  const qrImgUrl = publicUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=10&data=${encodeURIComponent(publicUrl)}` : "";

  const handlePhotoUpload = (file) => {
    if (!file) return;
    setPhotoUploading(true);
    const reader = new FileReader();
    reader.onload = () => { setBgPhoto(reader.result); setPhotoUploading(false); };
    reader.onerror = () => setPhotoUploading(false);
    reader.readAsDataURL(file);
  };

  const generatePdf = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${flyerTitle || "Sondage"}</title>
<style>
@page { size: A4; margin: 0; }
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;background:#fff}
.bgphoto{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:${bgOpacity / 100};z-index:0}
.content{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30mm 20mm;text-align:center}
.logo{height:50px;max-width:200px;object-fit:contain;margin-bottom:18mm}
.title{font-size:34px;font-weight:800;color:#1a1a1a;line-height:1.25;margin-bottom:10px;max-width:160mm}
.subtitle{font-size:16px;color:#444;line-height:1.5;margin-bottom:16mm;max-width:150mm}
.qrbox{background:#fff;border-radius:16px;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,.12);border:2px solid ${accent}20}
.qrbox img{width:200px;height:200px;display:block}
.qrcaption{margin-top:18mm;font-size:15px;font-weight:700;color:${accent};letter-spacing:0.5px}
.body{margin-top:8mm;font-size:13px;color:#666;line-height:1.6;max-width:130mm}
.link{margin-top:6mm;font-size:10px;color:#999;word-break:break-all}
.accentbar{position:absolute;top:0;left:0;right:0;height:10px;background:${accent};z-index:2}
</style></head><body>
<div class="page">
  ${bgPhoto ? `<img class="bgphoto" src="${bgPhoto}" alt="" />` : ""}
  <div class="accentbar"></div>
  <div class="content">
    <img class="logo" src="${logo}" alt="Logo" />
    <div class="title">${(flyerTitle || "").replace(/</g, "&lt;")}</div>
    ${flyerSubtitle ? `<div class="subtitle">${flyerSubtitle.replace(/</g, "&lt;")}</div>` : ""}
    <div class="qrbox"><img src="${qrImgUrl}" alt="QR Code" /></div>
    <div class="qrcaption">${(qrCaption || "").replace(/</g, "&lt;")}</div>
    ${flyerBody ? `<div class="body">${flyerBody.replace(/</g, "&lt;")}</div>` : ""}
    <div class="link">${publicUrl}</div>
  </div>
</div>
</body></html>`;
    downloadAsPdf(html);
    addToast({ title: "📄 Flyer généré — choisissez \"Enregistrer en PDF\"", icon: "📄" });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, width: "min(900px, 96vw)", maxHeight: "92vh", overflowY: "auto", display: "flex", flexWrap: "wrap" }}>

        {/* Editor */}
        <div style={{ flex: "1 1 320px", padding: 22, borderRight: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>📄 Flyer PDF</div>

          <Input label="Titre" value={flyerTitle} onChange={setFlyerTitle} placeholder="Donnez-nous votre avis !" />
          <Input label="Sous-titre" value={flyerSubtitle} onChange={setFlyerSubtitle} placeholder="Votre opinion compte pour nous" />
          <Textarea label="Texte du corps" value={flyerBody} onChange={setFlyerBody} rows={3} />
          <Input label="Texte sous le QR code" value={qrCaption} onChange={setQrCaption} placeholder="Scannez-moi" />

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>🖼️ Photo en arrière-plan (transparence)</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: bgPhoto ? 10 : 0 }}>
              {bgPhoto ? (
                <div style={{ position: "relative" }}>
                  <img src={bgPhoto} alt="fond" style={{ height: 60, width: 90, objectFit: "cover", borderRadius: 8, border: "1px solid #E2E8F0" }} />
                  <button onClick={() => setBgPhoto("")} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#EF4444", color: "#fff", border: "none", fontSize: 10, cursor: "pointer", lineHeight: "18px" }}>✕</button>
                </div>
              ) : (
                <div style={{ height: 60, width: 90, borderRadius: 8, border: "1.5px dashed #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#CBD5E1" }}>🖼️</div>
              )}
              <label style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#6B7280", fontFamily: "inherit" }}>
                {photoUploading ? "⏳ Upload..." : bgPhoto ? "🔄 Changer" : "📷 Importer une photo"}
                <input type="file" accept="image/*" onChange={e => handlePhotoUpload(e.target.files?.[0])} style={{ display: "none" }} />
              </label>
            </div>
            {bgPhoto && (
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>Opacité : {bgOpacity}%</label>
                <input type="range" min="5" max="60" value={bgOpacity} onChange={e => setBgOpacity(Number(e.target.value))} style={{ width: "100%" }} />
              </div>
            )}
          </div>

          <Btn onClick={generatePdf}>📥 Générer le PDF</Btn>
          <button onClick={onClose} style={{ display: "block", width: "100%", marginTop: 8, padding: "10px", background: "none", border: "none", color: "#94A3B8", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
        </div>

        {/* Live preview */}
        <div style={{ flex: "1 1 320px", padding: 22, background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", width: 280, height: 396, background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,.15)", border: "1px solid #E2E8F0" }}>
            {bgPhoto && <img src={bgPhoto} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: bgOpacity / 100 }} />}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: accent }} />
            <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 18px", textAlign: "center" }}>
              <img src={logo} alt="Logo" style={{ height: 28, maxWidth: 120, objectFit: "contain", marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.3, marginBottom: 6 }}>{flyerTitle || "Titre du flyer"}</div>
              {flyerSubtitle && <div style={{ fontSize: 9, color: "#444", lineHeight: 1.4, marginBottom: 14 }}>{flyerSubtitle}</div>}
              <div style={{ background: "#fff", borderRadius: 10, padding: 8, boxShadow: "0 4px 16px rgba(0,0,0,.12)", border: `1.5px solid ${accent}20` }}>
                {qrImgUrl && <img src={qrImgUrl} alt="QR" style={{ width: 80, height: 80, display: "block" }} />}
              </div>
              <div style={{ marginTop: 10, fontSize: 10, fontWeight: 700, color: accent }}>{qrCaption || "Scannez-moi"}</div>
              {flyerBody && <div style={{ marginTop: 6, fontSize: 7, color: "#666", lineHeight: 1.4 }}>{flyerBody}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Generate a detailed, interpreted PDF report for survey results ──────
function exportResultsPdf(survey, responses, getQuestionStats) {
  const total = responses.length;
  const submittedDates = responses.map(r => new Date(r.submittedAt)).filter(d => !isNaN(d));
  const firstDate = submittedDates.length ? new Date(Math.min(...submittedDates)) : null;
  const lastDate = submittedDates.length ? new Date(Math.max(...submittedDates)) : null;
  const fmtDate = (d) => d ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

  // Overall completion: average % of questions answered per response
  const completionRates = responses.map(r => {
    const answered = survey.questions.filter(q => { const a = r.answers?.[q.id]; return a !== undefined && a !== "" && !(Array.isArray(a) && a.length === 0); }).length;
    return survey.questions.length > 0 ? answered / survey.questions.length : 0;
  });
  const avgCompletion = completionRates.length ? Math.round(completionRates.reduce((s, c) => s + c, 0) / completionRates.length * 100) : 0;
  const fullyCompleted = completionRates.filter(c => c === 1).length;

  const esc = (s) => String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Build per-question analysis with auto-interpretation text
  let questionsHtml = "";
  survey.questions.forEach((q, qi) => {
    const stats = getQuestionStats(q);
    const responseRate = total > 0 ? Math.round(((total - stats.skipped) / total) * 100) : 0;
    let interpretation = "";
    let body = "";

    if (q.type === "text") {
      interpretation = stats.answers.length > 0
        ? `${stats.answers.length} réponse(s) libre(s) collectée(s), soit ${responseRate}% des participants. ${stats.skipped > 0 ? `${stats.skipped} personne(s) n'ont pas répondu à cette question.` : "Toutes les personnes ont répondu."}`
        : "Aucune réponse n'a été apportée à cette question ouverte.";
      body = stats.answers.length > 0
        ? `<div class="textlist">${stats.answers.map(a => `<div class="textitem">"${esc(a)}"</div>`).join("")}</div>`
        : `<div class="empty">Aucune réponse</div>`;
    }

    if (q.type === "scale") {
      const avgNum = parseFloat(stats.avg);
      const tone = isNaN(avgNum) ? "" : avgNum >= 7.5 ? "très positive" : avgNum >= 5.5 ? "globalement positive" : avgNum >= 4 ? "mitigée" : "négative";
      const maxIdx = stats.distribution.indexOf(Math.max(...stats.distribution));
      const modeNote = stats.count > 0 ? maxIdx + 1 : null;
      interpretation = stats.count > 0
        ? `La note moyenne est de <strong>${stats.avg}/10</strong>, ce qui traduit une perception ${tone} de cet aspect. La note la plus fréquemment donnée est <strong>${modeNote}/10</strong>. ${stats.skipped > 0 ? `${stats.skipped} participant(s) n'ont pas répondu (${responseRate}% de taux de réponse).` : "Toutes les personnes ont répondu à cette question."}`
        : "Aucune note n'a été attribuée pour cette question.";
      const maxCnt = Math.max(...stats.distribution, 1);
      body = `<div class="scalerow">
        <div class="scalebig" style="color:${avgNum >= 7 ? "#10B981" : avgNum >= 4 ? "#F59E0B" : "#EF4444"}">${stats.avg}<span class="scaleon10">/10</span></div>
        <div class="scalebars">${stats.distribution.map((cnt, i) => `<div class="scalebarcol"><div class="scalebar" style="height:${Math.round((cnt / maxCnt) * 50) + 2}px;background:${i + 1 >= 7 ? "#10B981" : i + 1 >= 4 ? "#F59E0B" : "#EF4444"}" title="${cnt}"></div><div class="scalelabel">${i + 1}</div></div>`).join("")}</div>
      </div>`;
    }

    if (q.type === "single" || q.type === "multi") {
      const entries = Object.entries(stats.counts).sort((a, b) => b[1] - a[1]);
      const winner = entries.length && entries[0][1] > 0 ? entries[0] : null;
      const winnerPct = winner && total > 0 ? Math.round(winner[1] / total * 100) : 0;
      interpretation = winner
        ? `L'option la plus choisie est <strong>"${esc(winner[0])}"</strong> avec ${winner[1]} réponse(s) (${winnerPct}% des participants)${q.type === "multi" ? ", les répondants pouvant choisir plusieurs options" : ""}. ${stats.skipped > 0 ? `${stats.skipped} participant(s) n'ont pas répondu à cette question.` : "Toutes les personnes ont répondu à cette question."}`
        : "Aucune réponse n'a été enregistrée pour cette question.";
      body = `<div class="barlist">${entries.map(([opt, cnt]) => { const pct = total > 0 ? Math.round(cnt / total * 100) : 0; const isWinner = winner && opt === winner[0]; return `
        <div class="barrow">
          <div class="barlabel">${isWinner ? "🏆 " : ""}${esc(opt)}</div>
          <div class="bartrack"><div class="barfill" style="width:${pct}%;background:${isWinner ? "#10B981" : "#0F56B8"}"></div></div>
          <div class="barvalue">${cnt} (${pct}%)</div>
        </div>`; }).join("")}</div>`;
    }

    questionsHtml += `
      <div class="qblock">
        <div class="qhead"><span class="qnum">Q${qi + 1}</span><span class="qtitle">${esc(q.label)}</span>${stats.skipped > 0 ? `<span class="qskip">⏭ ${stats.skipped} sauté${stats.skipped > 1 ? "s" : ""}</span>` : ""}</div>
        ${body}
        <div class="interpretation">📊 ${interpretation}</div>
      </div>`;
  });

  // Executive summary: pick the most/least answered questions, overall tone
  const skipRates = survey.questions.map(q => ({ label: q.label, skipped: getQuestionStats(q).skipped }));
  const mostSkipped = skipRates.sort((a, b) => b.skipped - a.skipped)[0];

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rapport — ${esc(survey.title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;font-size:11px}
.page{padding:18mm 16mm;max-width:210mm;margin:0 auto}
.header{background:linear-gradient(135deg,#1E3A5F,#0F56B8);color:#fff;padding:26px 30px;margin-bottom:22px;border-radius:14px}
.header h1{font-size:22px;margin:0 0 4px}
.header .sub{font-size:11px;opacity:.75}
.header .meta{display:flex;gap:24px;margin-top:14px;flex-wrap:wrap}
.header .metaitem{font-size:10px;opacity:.9}
.header .metaval{font-size:20px;font-weight:800;display:block}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
.kpi{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px;text-align:center}
.kpival{font-size:22px;font-weight:800;color:#0F56B8}
.kpilabel{font-size:9px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
.summary{background:#F0F9FF;border-left:4px solid #0F56B8;border-radius:0 10px 10px 0;padding:16px 18px;margin-bottom:24px;font-size:12px;line-height:1.7;color:#1a1a1a}
.summary b{color:#0F56B8}
h2{font-size:15px;color:#1E3A5F;margin:24px 0 12px;padding-bottom:6px;border-bottom:2px solid #1E3A5F}
.qblock{margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #F1F5F9}
.qhead{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
.qnum{background:#0F56B8;color:#fff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:5px}
.qtitle{font-size:13px;font-weight:700;flex:1}
.qskip{font-size:9px;background:#FEF3C7;color:#B45309;padding:2px 8px;border-radius:5px;font-weight:600}
.interpretation{margin-top:10px;font-size:11px;line-height:1.6;color:#374151;background:#FAFBFC;padding:10px 14px;border-radius:8px;border-left:3px solid #94A3B8}
.textlist{display:flex;flex-direction:column;gap:5px;max-height:none}
.textitem{font-size:11px;color:#1a1a1a;padding:8px 10px;background:#F8FAFC;border-radius:6px;border-left:3px solid #0F56B8;font-style:italic}
.empty{font-size:10px;color:#CBD5E1;font-style:italic}
.scalerow{display:flex;align-items:center;gap:20px}
.scalebig{font-size:32px;font-weight:800}
.scaleon10{font-size:13px;color:#94A3B8;font-weight:400}
.scalebars{display:flex;gap:4px;align-items:flex-end;height:60px;flex:1}
.scalebarcol{flex:1;text-align:center}
.scalebar{border-radius:3px;margin-bottom:3px}
.scalelabel{font-size:8px;color:#94A3B8}
.barlist{display:flex;flex-direction:column;gap:8px}
.barrow{display:flex;align-items:center;gap:10px}
.barlabel{font-size:11px;width:140px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bartrack{flex:1;height:10px;background:#F1F5F9;border-radius:5px;overflow:hidden}
.barfill{height:100%;border-radius:5px}
.barvalue{font-size:10px;font-weight:700;width:70px;text-align:right;flex-shrink:0}
table{width:100%;border-collapse:collapse;font-size:10px;margin-top:10px}
th{background:#1E3A5F;color:#fff;padding:8px 10px;text-align:left;font-weight:700}
td{padding:7px 10px;border-bottom:1px solid #F1F5F9}
.footer{margin-top:30px;padding-top:10px;border-top:1px solid #E2E8F0;color:#94A3B8;font-size:8px;text-align:center}
.print-btn{position:fixed;top:20px;right:20px;padding:10px 20px;background:#0F56B8;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;z-index:999;font-family:inherit}
@media print{.print-btn{display:none!important}.page{padding:10mm}.qblock{break-inside:avoid}}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimer / PDF</button>
<div class="page">
  <div class="header">
    <h1>📊 Rapport d'analyse — ${esc(survey.title)}</h1>
    <div class="sub">${survey.anonymous ? "🔒 Sondage privé / anonyme" : "👤 Sondage nominatif"} · ${esc(survey.club ? "" : "")}Esprit Padel Communication</div>
    <div class="meta">
      <div class="metaitem"><span class="metaval">${total}</span>réponse(s) reçue(s)</div>
      <div class="metaitem"><span class="metaval">${firstDate ? fmtDate(firstDate) : "—"}</span>première réponse</div>
      <div class="metaitem"><span class="metaval">${lastDate ? fmtDate(lastDate) : "—"}</span>dernière réponse</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="kpival">${total}</div><div class="kpilabel">Répondants</div></div>
    <div class="kpi"><div class="kpival">${survey.questions.length}</div><div class="kpilabel">Questions</div></div>
    <div class="kpi"><div class="kpival">${avgCompletion}%</div><div class="kpilabel">Taux complétion moy.</div></div>
    <div class="kpi"><div class="kpival">${fullyCompleted}</div><div class="kpilabel">Réponses complètes</div></div>
  </div>

  <div class="summary">
    <b>📝 Synthèse :</b> Ce sondage a recueilli <b>${total} réponse${total > 1 ? "s" : ""}</b> entre le ${fmtDate(firstDate)} et le ${fmtDate(lastDate)}.
    En moyenne, les participants ont répondu à <b>${avgCompletion}%</b> des ${survey.questions.length} question(s) posées, et <b>${fullyCompleted} personne${fullyCompleted > 1 ? "s" : ""}</b> ${fullyCompleted > 1 ? "ont" : "a"} complété l'intégralité du questionnaire.
    ${mostSkipped && mostSkipped.skipped > 0 ? ` La question la plus souvent ignorée est <b>"${esc(mostSkipped.label)}"</b> (${mostSkipped.skipped} omission${mostSkipped.skipped > 1 ? "s" : ""}), ce qui peut indiquer une formulation peu claire ou un manque de pertinence perçue pour certains répondants.` : " Aucune question n'a été significativement ignorée, ce qui suggère un questionnaire bien calibré et pertinent pour l'ensemble des participants."}
  </div>

  <h2>📋 Analyse détaillée par question</h2>
  ${questionsHtml}

  ${!survey.anonymous ? `
  <h2>👤 Détail des réponses individuelles</h2>
  <table>
    <thead><tr><th>Nom</th><th>Date</th>${survey.questions.map(q => `<th>${esc(q.label.slice(0, 24))}</th>`).join("")}</tr></thead>
    <tbody>
      ${responses.map(r => `<tr><td><b>${esc(r.respondentName || "—")}</b></td><td>${new Date(r.submittedAt).toLocaleDateString("fr-FR")}</td>${survey.questions.map(q => { const a = r.answers?.[q.id]; const val = (a === undefined || a === "") ? `<span style="color:#F59E0B">Sauté</span>` : esc(Array.isArray(a) ? a.join(", ") : String(a)); return `<td>${val}</td>`; }).join("")}</tr>`).join("")}
    </tbody>
  </table>` : ""}

  <div class="footer">Esprit Padel Communication — Rapport généré automatiquement le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
</div>
</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) { const a = document.createElement("a"); a.href = url; a.download = `Rapport_${survey.title.replace(/[^a-zA-Z0-9]/g, "_")}.html`; a.click(); }
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function SurveyResults({ survey, responses, onBack }) {
  if (!survey) return null;
  const [resTab, setResTab] = useState("stats"); // stats | timeline
  const total = responses.length;

  const getQuestionStats = (q) => {
    const answers = responses.map(r => r.answers?.[q.id]).filter(a => a !== undefined && a !== null && a !== "");
    const skipped = total - answers.length;
    if (q.type === "text") {
      return { skipped, answers: answers.map(a => String(a)) };
    }
    if (q.type === "scale") {
      const nums = answers.map(Number).filter(n => !isNaN(n));
      const avg = nums.length > 0 ? (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(1) : "—";
      const distribution = Array.from({ length: 10 }, (_, i) => nums.filter(n => n === i + 1).length);
      return { skipped, avg, distribution, count: nums.length };
    }
    if (q.type === "single") {
      const counts = {};
      (q.options || []).forEach(o => counts[o] = 0);
      answers.forEach(a => { if (counts[a] !== undefined) counts[a]++; });
      return { skipped, counts };
    }
    if (q.type === "multi") {
      const counts = {};
      (q.options || []).forEach(o => counts[o] = 0);
      answers.forEach(a => { (Array.isArray(a) ? a : [a]).forEach(v => { if (counts[v] !== undefined) counts[v]++; }); });
      return { skipped, counts };
    }
    return { skipped };
  };

  // Sorted responses for timeline
  const sortedResponses = [...responses].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  // Distribution by hour of day
  const hourDist = Array.from({ length: 24 }, (_, h) => ({
    h,
    count: responses.filter(r => new Date(r.submittedAt).getHours() === h).length
  })).filter(h => h.count > 0);

  // Distribution by day
  const dayDist = {};
  responses.forEach(r => {
    const d = new Date(r.submittedAt).toLocaleDateString("fr-FR");
    dayDist[d] = (dayDist[d] || 0) + 1;
  });
  const dayEntries = Object.entries(dayDist).sort((a, b) => new Date(a[0].split("/").reverse().join("-")) - new Date(b[0].split("/").reverse().join("-")));
  const maxDayCount = Math.max(...Object.values(dayDist), 1);

  // Scale vote counts (for questions with type=scale, count votes per value 1-10)
  const scaleQuestions = survey.questions.filter(q => q.type === "scale");

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#0F56B8", fontWeight: 600, fontFamily: "inherit" }}>← Retour aux sondages</button>
      {total > 0 && <Btn onClick={() => exportResultsPdf(survey, responses, getQuestionStats)} small>📥 Télécharger le rapport PDF</Btn>}
    </div>
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#2D2D30" }}>{survey.title}</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{total} réponse(s) reçue(s) {survey.anonymous ? "· 🔒 Privées" : "· 👤 Nominatives"}</div>
    </div>

    {/* Tabs */}
    {total > 0 && (
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        <button onClick={() => setResTab("stats")} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: resTab === "stats" ? "#0F56B8" : "#F1F5F9", color: resTab === "stats" ? "#fff" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📊 Résultats</button>
        <button onClick={() => setResTab("timeline")} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: resTab === "timeline" ? "#0F56B8" : "#F1F5F9", color: resTab === "timeline" ? "#fff" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📅 Chronologie & votes</button>
      </div>
    )}

    {/* ── TIMELINE TAB ── */}
    {resTab === "timeline" && total > 0 && (
      <div>
        {/* Votes par note (scale questions) */}
        {scaleQuestions.map(q => {
          const stats = getQuestionStats(q);
          const maxCnt = Math.max(...stats.distribution, 1);
          return (
            <Card key={q.id} style={{ padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30", marginBottom: 10 }}>🎚️ {q.label}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginBottom: 6 }}>
                {stats.distribution.map((cnt, i) => {
                  const note = i + 1;
                  const h = Math.max(Math.round((cnt / maxCnt) * 80), cnt > 0 ? 4 : 0);
                  const col = note >= 7 ? "#10B981" : note >= 4 ? "#F59E0B" : "#EF4444";
                  return (
                    <div key={i} style={{ flex: 1, textAlign: "center" }}>
                      {cnt > 0 && <div style={{ fontSize: 11, fontWeight: 800, color: col, marginBottom: 2 }}>{cnt}</div>}
                      <div style={{ height: h || 3, background: cnt > 0 ? col : "#F1F5F9", borderRadius: 4, marginBottom: 4 }} />
                      <div style={{ fontSize: 12, fontWeight: cnt > 0 ? 700 : 400, color: cnt > 0 ? "#2D2D30" : "#CBD5E1" }}>{note}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>Moyenne : <strong style={{ color: "#2D2D30" }}>{stats.avg}/10</strong> · {stats.count} vote(s)</div>
            </Card>
          );
        })}

        {/* Réponses par jour (bar chart) */}
        {dayEntries.length > 0 && (
          <Card style={{ padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30", marginBottom: 10 }}>📆 Réponses par jour</div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", flexWrap: "wrap" }}>
              {dayEntries.map(([day, cnt]) => (
                <div key={day} style={{ textAlign: "center", minWidth: 44 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#0F56B8", marginBottom: 2 }}>{cnt}</div>
                  <div style={{ height: Math.round((cnt / maxDayCount) * 60) + 4, background: "#0F56B8", borderRadius: "4px 4px 0 0", minWidth: 36 }} />
                  <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 3, maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{day}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Journal chronologique de toutes les réponses */}
        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30", marginBottom: 10 }}>🕐 Journal des réponses ({total})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sortedResponses.map((r, idx) => {
              const dt = new Date(r.submittedAt);
              const date = dt.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
              const time = dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
              const answeredCount = survey.questions.filter(q => { const a = r.answers?.[q.id]; return a !== undefined && a !== "" && !(Array.isArray(a) && a.length === 0); }).length;
              const pct = Math.round(answeredCount / survey.questions.length * 100);
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#FAFBFC", borderRadius: 8, borderLeft: `3px solid #0F56B8` }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#0F56B815", color: "#0F56B8", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{total - idx}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {!survey.anonymous && r.respondentName && <div style={{ fontSize: 12, fontWeight: 700, color: "#2D2D30" }}>{r.respondentName}</div>}
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{date} à {time}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? "#10B981" : "#F59E0B" }}>{pct}%</div>
                    <div style={{ fontSize: 9, color: "#94A3B8" }}>{answeredCount}/{survey.questions.length} rép.</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    )}

    {/* ── STATS TAB ── */}
    {resTab === "stats" && (total === 0 ? (
      <Card style={{ padding: 30, textAlign: "center" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📭</div><div style={{ fontSize: 13, color: "#6B7280" }}>Aucune réponse pour le moment</div></Card>
    ) : (
      <>
        {survey.questions.map(q => {
          const stats = getQuestionStats(q);
          return (
            <Card key={q.id} style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30", flex: 1 }}>{q.label}</div>
                {stats.skipped > 0 && <span style={{ padding: "2px 8px", borderRadius: 6, background: "#F59E0B15", color: "#F59E0B", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>⏭ {stats.skipped} sauté{stats.skipped > 1 ? "s" : ""}</span>}
              </div>

              {q.type === "text" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                  {stats.answers.length === 0 ? <div style={{ fontSize: 11, color: "#CBD5E1" }}>Aucune réponse</div> : stats.answers.map((a, i) => <div key={i} style={{ fontSize: 12, color: "#2D2D30", padding: "8px 10px", background: "#F8FAFC", borderRadius: 8, borderLeft: "3px solid #0F56B8" }}>{a}</div>)}
                </div>
              )}

              {q.type === "scale" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: stats.avg >= 7 ? "#10B981" : stats.avg >= 4 ? "#F59E0B" : "#EF4444" }}>{stats.avg}</span>
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>/ 10 — moyenne sur {stats.count} réponse(s)</span>
                  </div>
                  <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 60 }}>
                    {stats.distribution.map((cnt, i) => { const maxCnt = Math.max(...stats.distribution, 1); const h = Math.round((cnt / maxCnt) * 56) + 2; return (
                      <div key={i} style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ height: h, background: i + 1 >= 7 ? "#10B981" : i + 1 >= 4 ? "#F59E0B" : "#EF4444", borderRadius: 3, marginBottom: 2 }} title={`${cnt} réponse(s) pour la note ${i + 1}`} />
                        <span style={{ fontSize: 8, color: "#94A3B8" }}>{i + 1}</span>
                      </div>
                    ); })}
                  </div>
                </div>
              )}

              {(q.type === "single" || q.type === "multi") && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {Object.entries(stats.counts).map(([opt, cnt]) => { const pct = total > 0 ? Math.round(cnt / total * 100) : 0; return (
                    <div key={opt}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#2D2D30", marginBottom: 3 }}><span>{opt}</span><span style={{ fontWeight: 700 }}>{cnt} ({pct}%)</span></div>
                      <div style={{ height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: "#0F56B8", borderRadius: 4, transition: "width .4s" }} /></div>
                    </div>
                  ); })}
                </div>
              )}
            </Card>
          );
        })}

        {/* Individual responses log (if nominative) */}
        {!survey.anonymous && (
          <Card style={{ padding: 16, marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📋 Détail des réponses</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ borderBottom: "2px solid #E2E8F0" }}><th style={{ padding: "6px 8px", textAlign: "left" }}>Nom</th><th style={{ padding: "6px 8px", textAlign: "left" }}>Date</th>{survey.questions.map(q => <th key={q.id} style={{ padding: "6px 8px", textAlign: "left", maxWidth: 120 }}>{q.label.slice(0, 20)}</th>)}</tr></thead>
                <tbody>
                  {responses.map(r => (<tr key={r.id} style={{ borderBottom: "1px solid #F4F2EF" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 600 }}>{r.respondentName || "—"}</td>
                    <td style={{ padding: "6px 8px", color: "#94A3B8" }}>{new Date(r.submittedAt).toLocaleDateString("fr-FR")}</td>
                    {survey.questions.map(q => { const a = r.answers?.[q.id]; return <td key={q.id} style={{ padding: "6px 8px" }}>{a === undefined || a === "" ? <span style={{ color: "#F59E0B" }}>Sauté</span> : Array.isArray(a) ? a.join(", ") : String(a)}</td>; })}
                  </tr>))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </>
    ))}
  </div>);
}

// ==================== PUBLIC SURVEY (no login, accessed via QR/link) ====================
function PublicSurveyPage({ surveyId }) {
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [answers, setAnswers] = useState({});
  const [respondentName, setRespondentName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(-1);
  const [direction, setDirection] = useState("forward");
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        let tries = 0;
        while (!_fb_db && tries < 20) { await new Promise(r => setTimeout(r, 200)); tries++; }
        if (!_fb_db) { setError(true); setLoading(false); return; }
        const snap = await fbGetDoc(fbDoc(_fb_db, "appdata", "ep:surveys"));
        if (snap.exists()) {
          const all = snap.data().value || [];
          const found = all.find(s => String(s.id) === String(surveyId));
          if (found) { setSurvey(found); setStep(found.anonymous ? 0 : -1); }
          else setError(true);
        } else setError(true);
      } catch { setError(true); }
      setLoading(false);
    })();
  }, [surveyId]);

  const totalSteps = survey ? survey.questions.length : 0;
  const currentQ = survey && step >= 0 && step < totalSteps ? survey.questions[step] : null;
  const accent = survey?.primaryColor || "#0F56B8";
  // Only use customLogo if it's a valid data URL (base64) - reject broken old Storage URLs
  const hasValidCustomLogo = survey?.customLogo && survey.customLogo.startsWith("data:") && !logoError;
  const logoSrc = hasValidCustomLogo ? survey.customLogo : LOGO_URI;

  const setAnswer = (qid, val) => setAnswers(p => ({ ...p, [qid]: val }));
  const toggleMultiAnswer = (qid, opt) => setAnswers(p => { const cur = p[qid] || []; const arr = Array.isArray(cur) ? cur : []; return { ...p, [qid]: arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt] }; });

  const goNext = () => { setDirection("forward"); if (step < totalSteps - 1) setStep(s => s + 1); else submit(); };
  const goBack = () => { setDirection("back"); if (step === 0 && !survey.anonymous) setStep(-1); else if (step > 0) setStep(s => s - 1); };
  const skipQuestion = () => { setDirection("forward"); setAnswers(p => { const np = { ...p }; delete np[currentQ.id]; return np; }); if (step < totalSteps - 1) setStep(s => s + 1); else submit(); };

  const submit = async () => {
    if (!survey) return;
    setSubmitting(true);
    try {
      const respSnap = await fbGetDoc(fbDoc(_fb_db, "appdata", "ep:surveyresponses"));
      const current = respSnap.exists() ? (respSnap.data().value || []) : [];
      const newResponse = { id: uid(), surveyId: survey.id, respondentName: survey.anonymous ? null : respondentName.trim(), answers, submittedAt: new Date().toISOString() };
      await setDoc(fbDoc(_fb_db, "appdata", "ep:surveyresponses"), { value: [...current, newResponse], updatedAt: Date.now() });
      setSubmitted(true);
    } catch (e) { console.error(e); alert("Erreur lors de l'envoi. Réessayez."); }
    setSubmitting(false);
  };

  const wrapStyle = { minHeight: "100vh", background: `linear-gradient(135deg, ${accent}E6 0%, ${accent} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "Montserrat, sans-serif" };
  const cardStyle = { background: "#fff", borderRadius: 24, padding: "48px 40px", width: "min(680px, 100%)", boxShadow: "0 24px 70px rgba(0,0,0,.35)", position: "relative", overflow: "hidden" };
  const LogoHeader = () => (<div style={{ textAlign: "center", marginBottom: 32 }}><img src={logoSrc} alt="Logo" onError={() => setLogoError(true)} style={{ height: 92, maxWidth: 340, objectFit: "contain" }} /></div>);

  if (loading) return (<div style={wrapStyle}><div style={cardStyle}><LogoHeader /><div style={{ textAlign: "center", color: "#6B7280", fontSize: 19 }}>Chargement du sondage...</div></div></div>);
  if (error || !survey) return (<div style={wrapStyle}><div style={cardStyle}><LogoHeader /><div style={{ textAlign: "center" }}><div style={{ fontSize: 60, marginBottom: 18 }}>😕</div><div style={{ fontSize: 24, fontWeight: 700, color: "#2D2D30" }}>Sondage introuvable</div><div style={{ fontSize: 16, color: "#94A3B8", marginTop: 10 }}>Ce lien n'est plus valide ou le sondage a été supprimé.</div></div></div></div>);
  if (!survey.active) return (<div style={wrapStyle}><div style={cardStyle}><LogoHeader /><div style={{ textAlign: "center" }}><div style={{ fontSize: 60, marginBottom: 18 }}>🔒</div><div style={{ fontSize: 24, fontWeight: 700, color: "#2D2D30" }}>Sondage fermé</div><div style={{ fontSize: 16, color: "#94A3B8", marginTop: 10 }}>Ce sondage n'accepte plus de réponses.</div></div></div></div>);

  if (submitted) return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        <LogoHeader />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 76, marginBottom: 20 }}>✅</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#2D2D30" }}>Merci pour votre réponse !</div>
          <div style={{ fontSize: 18, color: "#6B7280", marginTop: 14 }}>Votre avis a bien été enregistré.</div>
        </div>
      </div>
    </div>
  );

  if (step === -1) {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>
          <LogoHeader />
          <div style={{ textAlign: "center", marginBottom: 34 }}>
            <div style={{ fontSize: 29, fontWeight: 800, color: "#2D2D30", lineHeight: 1.3 }}>{survey.title}</div>
            {survey.description && <div style={{ fontSize: 18, color: "#6B7280", marginTop: 14, lineHeight: 1.6 }}>{survey.description}</div>}
          </div>
          <label style={{ display: "block", fontSize: 17, fontWeight: 600, color: "#6B7280", marginBottom: 10 }}>Votre nom *</label>
          <input
            autoFocus
            value={respondentName}
            onChange={e => setRespondentName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && respondentName.trim() && setStep(0)}
            placeholder="Prénom et nom"
            style={{ width: "100%", padding: "20px 22px", borderRadius: 14, border: "2px solid #E2E8F0", fontSize: 20, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 28 }}
          />
          <button
            onClick={() => respondentName.trim() && setStep(0)}
            disabled={!respondentName.trim()}
            style={{ width: "100%", padding: "20px", borderRadius: 14, border: "none", background: respondentName.trim() ? accent : "#E2E8F0", color: respondentName.trim() ? "#fff" : "#94A3B8", fontSize: 20, fontWeight: 700, cursor: respondentName.trim() ? "pointer" : "default", fontFamily: "inherit" }}
          >Commencer le sondage →</button>
        </div>
      </div>
    );
  }

  const answered = currentQ && answers[currentQ.id] !== undefined && answers[currentQ.id] !== "" && !(Array.isArray(answers[currentQ.id]) && answers[currentQ.id].length === 0);
  const isLastStep = step === totalSteps - 1;

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        <LogoHeader />

        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: accent }}>Question {step + 1} / {totalSteps}</span>
            <span style={{ fontSize: 18, color: "#94A3B8" }}>{Math.round(((step + 1) / totalSteps) * 100)}%</span>
          </div>
          <div style={{ height: 10, background: "#F1F5F9", borderRadius: 5, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${((step + 1) / totalSteps) * 100}%`, background: `linear-gradient(90deg, ${accent}, #10B981)`, borderRadius: 5, transition: "width .35s ease" }} />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 14, justifyContent: "center", flexWrap: "wrap" }}>
            {survey.questions.map((q, i) => {
              const isDone = i < step;
              const isCurrent = i === step;
              const wasAnswered = answers[q.id] !== undefined && answers[q.id] !== "" && !(Array.isArray(answers[q.id]) && answers[q.id].length === 0);
              return <div key={q.id} style={{ width: isCurrent ? 14 : 9, height: isCurrent ? 14 : 9, borderRadius: "50%", background: isCurrent ? accent : isDone ? (wasAnswered ? "#10B981" : "#F59E0B") : "#E2E8F0", transition: "all .25s" }} />;
            })}
          </div>
        </div>

        <div key={currentQ.id} style={{ animation: `${direction === "forward" ? "slideInRight" : "slideInLeft"} .3s ease` }}>
          <label style={{ display: "block", fontSize: 28, fontWeight: 700, color: "#2D2D30", marginBottom: 30, lineHeight: 1.4 }}>{currentQ.label}</label>

          {currentQ.type === "text" && (
            <textarea autoFocus value={answers[currentQ.id] || ""} onChange={e => setAnswer(currentQ.id, e.target.value)} placeholder="Votre réponse..." rows={4} style={{ width: "100%", padding: "20px 22px", borderRadius: 14, border: "2px solid #E2E8F0", fontSize: 19, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
          )}

          {currentQ.type === "single" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {(currentQ.options || []).map((opt, oi) => { const sel = answers[currentQ.id] === opt; return (
                <button key={oi} onClick={() => setAnswer(currentQ.id, opt)} style={{ display: "flex", alignItems: "center", gap: 18, padding: "20px 24px", borderRadius: 14, border: `2px solid ${sel ? accent : "#E2E8F0"}`, background: sel ? accent + "0D" : "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all .15s" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", border: `3px solid ${sel ? accent : "#CBD5E1"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{sel && <div style={{ width: 15, height: 15, borderRadius: "50%", background: accent }} />}</div>
                  <span style={{ fontSize: 21, color: "#2D2D30", lineHeight: 1.4 }}>{opt}</span>
                </button>
              ); })}
            </div>
          )}

          {currentQ.type === "multi" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {(currentQ.options || []).map((opt, oi) => { const sel = (answers[currentQ.id] || []).includes(opt); return (
                <button key={oi} onClick={() => toggleMultiAnswer(currentQ.id, opt)} style={{ display: "flex", alignItems: "center", gap: 18, padding: "20px 24px", borderRadius: 14, border: `2px solid ${sel ? accent : "#E2E8F0"}`, background: sel ? accent + "0D" : "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all .15s" }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, border: `3px solid ${sel ? accent : "#CBD5E1"}`, background: sel ? accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{sel && <span style={{ color: "#fff", fontSize: 19, fontWeight: 800 }}>✓</span>}</div>
                  <span style={{ fontSize: 21, color: "#2D2D30", lineHeight: 1.4 }}>{opt}</span>
                </button>
              ); })}
            </div>
          )}

          {currentQ.type === "scale" && (
            <div>
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => { const sel = answers[currentQ.id] === n; return (
                  <button key={n} onClick={() => setAnswer(currentQ.id, n)} style={{ flex: "1 0 8%", minWidth: 50, padding: "20px 0", borderRadius: 12, border: `2px solid ${sel ? accent : "#E2E8F0"}`, background: sel ? accent : "#fff", color: sel ? "#fff" : "#2D2D30", fontSize: 21, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}>{n}</button>
                ); })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, color: "#94A3B8", marginTop: 14 }}><span>Pas du tout</span><span>Totalement</span></div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 40 }}>
          <button onClick={goBack} style={{ padding: "20px 26px", borderRadius: 14, border: "2px solid #E2E8F0", background: "#fff", color: "#6B7280", fontSize: 18, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>← Retour</button>
          {!answered && (
            <button onClick={skipQuestion} style={{ flex: 1, padding: "20px 26px", borderRadius: 14, border: "2px solid #E2E8F0", background: "#fff", color: "#94A3B8", fontSize: 18, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Passer</button>
          )}
          <button
            onClick={goNext}
            disabled={submitting}
            style={{ flex: 1, padding: "20px 26px", borderRadius: 14, border: "none", background: submitting ? "#94A3B8" : accent, color: "#fff", fontSize: 18, fontWeight: 700, cursor: submitting ? "default" : "pointer", fontFamily: "inherit" }}
          >{submitting ? "Envoi..." : isLastStep ? "Envoyer ✓" : "Suivant →"}</button>
        </div>

        {isLastStep && (
          <div style={{ textAlign: "center", fontSize: 16, color: "#CBD5E1", marginTop: 22 }}>⚠️ Une fois envoyé, vous ne pourrez plus modifier vos réponses.</div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}

// ==================== SETTINGS ====================
function SettingsPage({ clubs, setClubs, users, setUsers, isAdmin, activityLog, customPages, setCustomPages, addToast, competences, setCompetences, currentUserId }) {
  const [tab, setTab] = useState("clubs");
  const [clubModal, setClubModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [editClub, setEditClub] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [clubForm, setClubForm] = useState({ name: "", color: "#0F56B8", instagram: { username: "", token: "", connected: false } });
  const [userForm, setUserForm] = useState({ firstName: "", lastName: "", email: "", phone: "", role: "", clubs: [], admin: false, password: "" });
  const [evalUser, setEvalUser] = useState(null);
  const [notifMsg, setNotifMsg] = useState("");
  const [notifTarget, setNotifTarget] = useState("all");
  const [notifClub, setNotifClub] = useState(null);
  const [notifRole, setNotifRole] = useState("");
  const [notifUser, setNotifUser] = useState("");
  const [notifSent, setNotifSent] = useState(false);
  const notifRoles = ["Alternant communication", "Communication", "Manager", "Directeur", "JA", "Autre"];
  const getNotifTargetUsers = () => {
    if (notifTarget === "all") return users.filter(u => String(u.id) !== String(currentUserId));
    if (notifTarget === "club" && notifClub) return users.filter(u => String(u.id) !== String(currentUserId) && (u.clubs || []).some(uc => String(uc) === String(notifClub)));
    if (notifTarget === "role" && notifRole) return users.filter(u => String(u.id) !== String(currentUserId) && u.role === notifRole);
    if (notifTarget === "user" && notifUser) return users.filter(u => String(u.id) === String(notifUser));
    return [];
  };
  const sendNotifAction = () => {
    if (!notifMsg.trim()) return;
    getNotifTargetUsers().forEach(u => { addToast({ title: `📢 ${notifMsg}`, icon: "📢", badges: ["Admin"], target: "dashboard", notifType: "ADMIN_MESSAGE" }, [u.id]); });
    setNotifSent(true); setTimeout(() => setNotifSent(false), 3000); setNotifMsg("");
  };
  const [evalPeriod, setEvalPeriod] = useState(String(new Date().getFullYear()));
  const colorChoices = ["#0F56B8","#059669","#D97706","#FEB601","#EF4444","#EC4899","#14B8A6","#F97316","#6366F1","#84CC16"];

  const openNewClub = () => { setEditClub(null); setClubForm({ name: "", color: "#0F56B8", instagram: { username: "", token: "", connected: false } }); setClubModal(true); };
  const openEditClub = (c) => { setEditClub(c.id); setClubForm({ name: c.name, color: c.color, instagram: c.instagram || { username: "", token: "", connected: false } }); setClubModal(true); };
  const saveClub = () => { if (!clubForm.name) return; if (editClub) setClubs(p => p.map(c => String(c.id) === String(editClub) ? { ...c, ...clubForm } : c)); else setClubs(p => [...p, { id: uid(), ...clubForm }]); setClubModal(false); };
  const delClub = (id) => setClubs(p => p.filter(c => String(c.id) !== String(id)));

  const openNewUser = () => { setEditUser(null); setUserForm({ firstName: "", lastName: "", email: "", phone: "", role: "", clubs: [], admin: false, password: "" }); setUserModal(true); };
  const openEditUser = (u) => { setEditUser(u.id); setUserForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone, role: u.role, clubs: u.clubs, admin: u.admin, password: u.password || "" }); setUserModal(true); };
  const saveUser = () => { if (!userForm.firstName || !userForm.email) return; if (editUser) setUsers(p => p.map(u => String(u.id) === String(editUser) ? { ...u, ...userForm, avatar: `${userForm.firstName[0]}${userForm.lastName[0]}`.toUpperCase() } : u)); else setUsers(p => [...p, { id: uid(), ...userForm, avatar: `${userForm.firstName[0] || ""}${userForm.lastName[0] || ""}`.toUpperCase(), daysOff: { Lundi: false, Mardi: false, Mercredi: false, Jeudi: false, Vendredi: false, Samedi: true, Dimanche: true }, vacations: [], passwordLog: [] }]); setUserModal(false); };
  const delUser = (id) => setUsers(p => p.filter(u => String(u.id) !== String(id)));
  const toggleUserClub = (cid) => setUserForm(p => ({ ...p, clubs: (p.clubs || []).some(x => String(x) === String(cid)) ? p.clubs.filter(x => String(x) !== String(cid)) : [...(p.clubs || []), cid] }));

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 700 }}>Paramètres</h2>
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        <button onClick={() => setTab("clubs")} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: tab === "clubs" ? "#0F56B8" : "#F1F5F9", color: tab === "clubs" ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Gestion des clubs</button>
        <button onClick={() => setTab("users")} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: tab === "users" ? "#0F56B8" : "#F1F5F9", color: tab === "users" ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Utilisateurs & accès</button>
        {isAdmin && <button onClick={() => setTab("logs")} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: tab === "logs" ? "#0F56B8" : "#F1F5F9", color: tab === "logs" ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🔒 Mots de passe</button>}
        {isAdmin && <button onClick={() => setTab("evals")} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: tab === "evals" ? "#0F56B8" : "#F1F5F9", color: tab === "evals" ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📊 Évaluations</button>}
        {isAdmin && <button onClick={() => setTab("activity")} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: tab === "activity" ? "#0F56B8" : "#F1F5F9", color: tab === "activity" ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📜 Historique</button>}
        {isAdmin && <button onClick={() => setTab("sendnotif")} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: tab === "sendnotif" ? "#0F56B8" : "#F1F5F9", color: tab === "sendnotif" ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📢 Envoyer notification</button>}
        {isAdmin && <button onClick={() => setTab("competences")} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: tab === "competences" ? "#0F56B8" : "#F1F5F9", color: tab === "competences" ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🏅 Compétences</button>}
        {isAdmin && <button onClick={() => setTab("pages")} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: tab === "pages" ? "#0F56B8" : "#F1F5F9", color: tab === "pages" ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🧩 Pages</button>}
      </div>
      {tab === "clubs" && (
        <div><Btn onClick={openNewClub} style={{ marginBottom: 16 }}>+ Nouveau club</Btn>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{clubs.map(c => {
            const ig = c.instagram || {};
            return (<Card key={c.id} style={{ padding: 14, borderLeft: `4px solid ${c.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#2D2D30" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{users.filter(u => (u.clubs || []).some(uc => String(uc) === String(c.id))).length} membres</div>
                  {ig.username ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: ig.connected ? "#10B981" : "#EF4444" }} />
                      <a href={`https://instagram.com/${ig.username}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#E4405F", fontWeight: 600, textDecoration: "none" }}>@{ig.username}</a>
                      <span style={{ fontSize: 9, color: ig.connected ? "#10B981" : "#94A3B8" }}>{ig.connected ? "Connecté" : "Non connecté"}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4 }}>Aucun Instagram configuré</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4 }}><button onClick={() => openEditClub(c)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>✏️</button><button onClick={() => delClub(c.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>🗑️</button></div>
              </div>
            </Card>);
          })}</div>
          <Modal open={clubModal} onClose={() => setClubModal(false)} title={editClub ? "Modifier le club" : "Nouveau club"}>
            <Input label="Nom" value={clubForm.name} onChange={v => setClubForm(p => ({ ...p, name: v }))} />
            <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Couleur</label><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{colorChoices.map(col => (<button key={col} onClick={() => setClubForm(p => ({ ...p, color: col }))} style={{ width: 32, height: 32, borderRadius: 8, background: col, border: clubForm.color === col ? "3px solid #2D2D30" : "2px solid transparent", cursor: "pointer" }} />))}</div></div>
            
            {/* Instagram section */}
            <div style={{ padding: 14, background: "#F4F2EF", borderRadius: 10, border: "1px solid #F1F5F9", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>📷</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30" }}>Instagram</span>
                {clubForm.instagram?.connected && <Badge text="Connecté" color="#10B981" small />}
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 3 }}>Nom d'utilisateur</label>
                <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                  <span style={{ padding: "7px 10px", background: "#E2E8F0", borderRadius: "8px 0 0 8px", fontSize: 12, color: "#6B7280", fontWeight: 600 }}>@</span>
                  <input value={clubForm.instagram?.username || ""} onChange={e => setClubForm(p => ({ ...p, instagram: { ...p.instagram, username: e.target.value } }))} placeholder="nom_utilisateur" style={{ flex: 1, padding: "7px 10px", borderRadius: "0 8px 8px 0", border: "1.5px solid #E2E8F0", borderLeft: "none", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 3 }}>Token d'accès (API Instagram Graph)</label>
                <input value={clubForm.instagram?.token || ""} onChange={e => setClubForm(p => ({ ...p, instagram: { ...p.instagram, token: e.target.value } }))} placeholder="EAAxxxxxxxx..." type="password" style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "JetBrains Mono, monospace", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={clubForm.instagram?.connected || false} onChange={() => setClubForm(p => ({ ...p, instagram: { ...p.instagram, connected: !p.instagram?.connected } }))} style={{ accentColor: "#10B981" }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280" }}>Marquer comme connecté</span>
                </label>
                {clubForm.instagram?.username && (
                  <a href={`https://instagram.com/${clubForm.instagram.username}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#E4405F", fontWeight: 600, textDecoration: "none", marginLeft: "auto" }}>Voir le profil ↗</a>
                )}
              </div>
            </div>

            <Btn onClick={saveClub}>Enregistrer</Btn>
          </Modal>
        </div>
      )}
      {tab === "users" && (
        <div><Btn onClick={openNewUser} style={{ marginBottom: 16 }}>+ Nouvel utilisateur</Btn>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{users.map(u => (<Card key={u.id} style={{ padding: 14 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><Avatar name={`${u.firstName} ${u.lastName}`} size={36} color={["#6366F1","#EC4899","#10B981","#F59E0B"][u.id % 4]} /><div><div style={{ fontSize: 14, fontWeight: 600, color: "#2D2D30" }}>{u.firstName} {u.lastName} {u.admin && <Badge text="Admin" color="#FEB601" small />}</div><div style={{ fontSize: 11, color: "#6B7280" }}>{u.role} · {u.email}</div><div style={{ display: "flex", gap: 3, marginTop: 3 }}>{u.clubs.map(cid => <ClubBadge key={cid} clubId={cid} clubs={clubs} />)}</div></div></div><div style={{ display: "flex", gap: 4 }}><button onClick={() => openEditUser(u)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>✏️</button><button onClick={() => delUser(u.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>🗑️</button></div></div></Card>))}</div>
          <Modal open={userModal} onClose={() => setUserModal(false)} title={editUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}><Input label="Prénom" value={userForm.firstName} onChange={v => setUserForm(p => ({ ...p, firstName: v }))} /><Input label="Nom" value={userForm.lastName} onChange={v => setUserForm(p => ({ ...p, lastName: v }))} /></div>
            <Input label="Email" value={userForm.email} onChange={v => setUserForm(p => ({ ...p, email: v }))} type="email" />
            <Input label="Téléphone" value={userForm.phone} onChange={v => setUserForm(p => ({ ...p, phone: v }))} />
            <Select label="Poste" value={userForm.role} onChange={v => setUserForm(p => ({ ...p, role: v }))} options={[{ value: "Alternant communication", label: "Alternant communication" }, { value: "Communication", label: "Communication" }, { value: "Manager", label: "Manager" }, { value: "Directeur", label: "Directeur" }, { value: "JA", label: "JA" }, { value: "Autre", label: "Autre" }]} />
            <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Clubs</label><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{clubs.map(c => { const sel = (userForm.clubs || []).some(x => String(x) === String(c.id)); return (<button key={c.id} onClick={() => toggleUserClub(c.id)} style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${sel ? c.color : "#E2E8F0"}`, background: sel ? c.color + "15" : "transparent", color: sel ? c.color : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{c.name}{sel && " ✓"}</button>); })}</div></div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }}><input type="checkbox" checked={userForm.admin} onChange={() => setUserForm(p => ({ ...p, admin: !p.admin }))} style={{ accentColor: "#FEB601" }} /><span style={{ fontSize: 13, fontWeight: 600, color: "#6B7280" }}>Administrateur</span></label>
            <Input label="Mot de passe" value={userForm.password} onChange={v => setUserForm(p => ({ ...p, password: v }))} />
            <Btn onClick={saveUser}>Enregistrer</Btn>
          </Modal>
        </div>
      )}
      {/* Admin: Password change log */}
      {tab === "logs" && isAdmin && (
        <div>
          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#2D2D30", marginBottom: 14 }}>🔒 Journal des changements de mot de passe</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 14 }}>Visible uniquement par les administrateurs</div>
            {users.every(u => !(u.passwordLog || []).length) ? (
              <div style={{ textAlign: "center", padding: 30, color: "#94A3B8", fontSize: 13 }}>Aucun changement de mot de passe enregistré</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#1E3A5F", color: "#fff" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Utilisateur</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Email</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Date</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Ancien MDP</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Nouveau MDP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.flatMap(u => (u.passwordLog || []).map((log, i) => ({ ...log, user: u, key: `${u.id}-${i}` }))).sort((a, b) => b.date.localeCompare(a.date)).map(log => (
                      <tr key={log.key} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600 }}>{log.user.firstName} {log.user.lastName}</td>
                        <td style={{ padding: "8px 10px", color: "#6B7280" }}>{log.user.email}</td>
                        <td style={{ padding: "8px 10px", color: "#6B7280" }}>{log.date}</td>
                        <td style={{ padding: "8px 10px", fontFamily: "JetBrains Mono, monospace", color: "#EF4444" }}>{log.oldPassword}</td>
                        <td style={{ padding: "8px 10px", fontFamily: "JetBrains Mono, monospace", color: "#10B981" }}>{log.newPassword}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          {/* Current passwords overview */}
          <Card style={{ marginTop: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#2D2D30", marginBottom: 14 }}>👥 Mots de passe actuels</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#1E3A5F", color: "#fff" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Utilisateur</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Email</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Mot de passe actuel</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Nb changements</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "8px 10px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={`${u.firstName} ${u.lastName}`} size={24} color={["#6366F1","#EC4899","#10B981","#F59E0B"][u.id % 4]} /><span style={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</span>{u.admin && <Badge text="Admin" color="#FEB601" small />}</div></td>
                      <td style={{ padding: "8px 10px", color: "#6B7280" }}>{u.email}</td>
                      <td style={{ padding: "8px 10px", fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>{u.password}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>{(u.passwordLog || []).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
      {/* Evaluations tab */}
      {tab === "evals" && isAdmin && (() => {
        const EVAL_CATEGORIES = [
          { id: "strategie", name: "Stratégie de communication", criteria: [
            { id: "s1", label: "Compréhension des objectifs de communication du club" },
            { id: "s2", label: "Capacité à définir une stratégie éditoriale cohérente" },
            { id: "s3", label: "Analyse et adaptation aux tendances du marché" },
            { id: "s4", label: "Proposition d'actions innovantes et créatives" },
          ]},
          { id: "reseaux", name: "Gestion des réseaux sociaux", criteria: [
            { id: "r1", label: "Qualité et régularité des publications" },
            { id: "r2", label: "Maîtrise des plateformes (Instagram, TikTok, Facebook)" },
            { id: "r3", label: "Engagement et interaction avec la communauté" },
            { id: "r4", label: "Croissance des abonnés et de la portée" },
            { id: "r5", label: "Utilisation des outils d'analyse (Metricool, insights)" },
          ]},
          { id: "contenu", name: "Création de contenu", criteria: [
            { id: "c1", label: "Qualité rédactionnelle (posts, newsletters, articles)" },
            { id: "c2", label: "Qualité visuelle (visuels, photos, vidéos)" },
            { id: "c3", label: "Respect de la charte graphique et identité de marque" },
            { id: "c4", label: "Capacité à adapter le ton selon la cible et le support" },
          ]},
          { id: "organisation", name: "Organisation & gestion de projet", criteria: [
            { id: "o1", label: "Respect des délais et du calendrier éditorial" },
            { id: "o2", label: "Gestion simultanée de plusieurs clubs / projets" },
            { id: "o3", label: "Planification et anticipation des événements" },
            { id: "o4", label: "Communication interne et reporting" },
          ]},
          { id: "soft", name: "Compétences transversales", criteria: [
            { id: "t1", label: "Autonomie et prise d'initiative" },
            { id: "t2", label: "Esprit d'équipe et collaboration" },
            { id: "t3", label: "Réactivité et gestion des imprévus" },
            { id: "t4", label: "Force de proposition et proactivité" },
            { id: "t5", label: "Montée en compétences et formation continue" },
          ]},
        ];
        const ratingLabels = ["", "Insuffisant", "À améliorer", "Satisfaisant", "Bien", "Excellent"];
        const ratingColors = ["", "#EF4444", "#FB8500", "#FEB601", "#10B981", "#0F56B8"];
        const eu = evalUser ? users.find(u => String(u.id) === String(evalUser)) : null;
        const getEvals = (uid2) => (users.find(u => String(u.id) === String(uid2))?.evaluations || {})[evalPeriod] || {};
        const setRating = (uid2, cid, val) => setUsers(p => p.map(u => String(u.id) !== String(uid2) ? u : { ...u, evaluations: { ...(u.evaluations || {}), [evalPeriod]: { ...((u.evaluations || {})[evalPeriod] || {}), [cid]: val } } }));
        const setComment = (uid2, key, val) => setUsers(p => p.map(u => String(u.id) !== String(uid2) ? u : { ...u, evaluations: { ...(u.evaluations || {}), [evalPeriod]: { ...((u.evaluations || {})[evalPeriod] || {}), [key]: val } } }));
        const allCr = EVAL_CATEGORIES.flatMap(c => c.criteria);
        const getAvg = (uid2) => { const ev = getEvals(uid2); const sc = allCr.map(c => ev[c.id] || 0).filter(s => s > 0); return sc.length > 0 ? (sc.reduce((a, b) => a + b, 0) / sc.length).toFixed(1) : "—"; };
        const getCatAvg = (uid2, catId) => { const ev = getEvals(uid2); const cat = EVAL_CATEGORIES.find(c => String(c.id) === String(catId)); if (!cat) return "—"; const sc = cat.criteria.map(c => ev[c.id] || 0).filter(s => s > 0); return sc.length > 0 ? (sc.reduce((a, b) => a + b, 0) / sc.length).toFixed(1) : "—"; };

        return (<div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6B7280" }}>Période :</span>
            <select value={evalPeriod} onChange={e => setEvalPeriod(e.target.value)} style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", background: "#fff" }}>
              {Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => String(2024 + i)).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {!eu ? (<div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30", marginBottom: 14 }}>Sélectionnez un collaborateur à évaluer</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {users.filter(u => String(u.id) !== String(1) && ["Alternant communication", "Communication"].includes(u.role)).map(u => {
                const avg = getAvg(u.id); const ev = getEvals(u.id); const filled = allCr.filter(c => ev[c.id] > 0).length;
                return (<Card key={u.id} style={{ padding: 16, cursor: "pointer", borderLeft: `4px solid ${["#6366F1","#EC4899","#10B981","#FB8500"][u.id % 4]}` }} onClick={() => setEvalUser(u.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={`${u.firstName} ${u.lastName}`} size={36} color={["#6366F1","#EC4899","#10B981","#FB8500"][u.id % 4]} />
                    <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30" }}>{u.firstName} {u.lastName}</div><div style={{ fontSize: 11, color: "#6B7280" }}>{u.role}</div></div>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: avg !== "—" ? ratingColors[Math.round(Number(avg))] : "#CBD5E1" }}>{avg}</div><div style={{ fontSize: 9, color: "#6B7280" }}>{filled}/{allCr.length} critères</div></div>
                  </div>
                </Card>);
              })}
            </div>
          </div>) : (<div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button onClick={() => setEvalUser(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#6B7280" }}>←</button>
              <Avatar name={`${eu.firstName} ${eu.lastName}`} size={40} color={["#6366F1","#EC4899","#10B981","#FB8500"][eu.id % 4]} />
              <div><div style={{ fontSize: 16, fontWeight: 700, color: "#2D2D30" }}>{eu.firstName} {eu.lastName}</div><div style={{ fontSize: 12, color: "#6B7280" }}>{eu.role} · Bilan {evalPeriod}</div></div>
              <div style={{ marginLeft: "auto", textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 800, color: getAvg(eu.id) !== "—" ? ratingColors[Math.round(Number(getAvg(eu.id)))] : "#CBD5E1" }}>{getAvg(eu.id)}</div><div style={{ fontSize: 10, color: "#6B7280" }}>Moyenne /5</div></div>
            </div>
            {EVAL_CATEGORIES.map(cat => (<Card key={cat.id} style={{ marginBottom: 14, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30" }}>{cat.name}</div><span style={{ fontSize: 14, fontWeight: 800, color: getCatAvg(eu.id, cat.id) !== "—" ? ratingColors[Math.round(Number(getCatAvg(eu.id, cat.id)))] : "#CBD5E1" }}>{getCatAvg(eu.id, cat.id)}/5</span></div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
                {cat.criteria.map(cr => { const val = getEvals(eu.id)[cr.id] || 0; return (
                  <tr key={cr.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "8px 0", fontSize: 12, color: "#2D2D30", width: "50%" }}>{cr.label}</td>
                    <td style={{ padding: "8px 0" }}><div style={{ display: "flex", gap: 3 }}>
                      {[1,2,3,4,5].map(n => (<button key={n} onClick={() => setRating(eu.id, cr.id, n)} style={{ width: 28, height: 28, borderRadius: 6, border: val === n ? `2px solid ${ratingColors[n]}` : "1.5px solid #E2E8F0", background: val >= n ? ratingColors[n] + "20" : "#fff", color: val >= n ? ratingColors[n] : "#CBD5E1", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{n}</button>))}
                    </div></td>
                    <td style={{ padding: "8px 0 8px 8px", fontSize: 10, color: val > 0 ? ratingColors[val] : "#CBD5E1", fontWeight: 600, width: 80 }}>{val > 0 ? ratingLabels[val] : "Non noté"}</td>
                  </tr>); })}
              </tbody></table>
            </Card>))}
            <Card style={{ padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30", marginBottom: 12 }}>💬 Commentaires & objectifs</div>
              {[{ key: "strengths", label: "Points forts", ph: "Points forts observés..." }, { key: "improvements", label: "Axes d'amélioration", ph: "Points à améliorer..." }, { key: "goals", label: "Objectifs prochaine période", ph: "Objectifs fixés..." }].map(f => (
                <div key={f.key} style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>{f.label}</label>
                  <textarea value={getEvals(eu.id)[f.key] || ""} onChange={e => setComment(eu.id, f.key, e.target.value)} rows={2} placeholder={f.ph} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                </div>
              ))}
            </Card>
            {/* Download evaluation PDF */}
            <div style={{ marginTop: 14 }}>
              <button onClick={() => {
                const ev = getEvals(eu.id);
                const allScores = allCr.map(c => ev[c.id] || 0).filter(s => s > 0);
                const avg = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : "—";
                let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Évaluation ${eu.firstName} ${eu.lastName} ${evalPeriod}</title><style>
                  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap');
                  * { box-sizing: border-box; margin: 0; padding: 0; }
                  body { font-family: 'Montserrat', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #2D2D30; }
                  .header { display: flex; align-items: center; gap: 20px; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #0F56B8; }
                  .logo { background: #2D2D30; padding: 10px 20px; border-radius: 8px; }
                  .logo img { height: 30px; }
                  .header-info { flex: 1; }
                  .header-info h1 { font-size: 20px; font-weight: 800; color: #2D2D30; }
                  .header-info p { font-size: 12px; color: #6B7280; margin-top: 4px; }
                  .avg-box { text-align: center; padding: 10px 20px; background: #F4F2EF; border-radius: 10px; }
                  .avg-box .score { font-size: 32px; font-weight: 800; }
                  .avg-box .label { font-size: 10px; color: #6B7280; }
                  .category { margin-bottom: 24px; }
                  .category h2 { font-size: 14px; font-weight: 700; margin-bottom: 10px; padding: 8px 12px; background: #F4F2EF; border-radius: 6px; display: flex; justify-content: space-between; }
                  .category h2 span { color: #0F56B8; }
                  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
                  td { padding: 6px 8px; font-size: 11px; border-bottom: 1px solid #E2E8F0; }
                  td:first-child { width: 55%; }
                  .rating { display: inline-flex; gap: 3px; }
                  .dot { width: 16px; height: 16px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #fff; }
                  .r1 { background: #EF4444; } .r2 { background: #FB8500; } .r3 { background: #FEB601; } .r4 { background: #10B981; } .r5 { background: #0F56B8; }
                  .empty { background: #E2E8F0; color: #94A3B8; }
                  .label-text { font-size: 10px; font-weight: 600; margin-left: 6px; }
                  .l1 { color: #EF4444; } .l2 { color: #FB8500; } .l3 { color: #FEB601; } .l4 { color: #10B981; } .l5 { color: #0F56B8; }
                  .comments { margin-top: 20px; padding: 16px; background: #F4F2EF; border-radius: 10px; }
                  .comments h3 { font-size: 13px; font-weight: 700; margin-bottom: 12px; }
                  .comment-block { margin-bottom: 10px; }
                  .comment-block label { font-size: 11px; font-weight: 600; color: #6B7280; display: block; margin-bottom: 3px; }
                  .comment-block p { font-size: 12px; line-height: 1.5; min-height: 20px; padding: 6px 0; border-bottom: 1px dashed #CBD5E1; }
                  .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #94A3B8; padding-top: 16px; border-top: 1px solid #E2E8F0; }
                  @media print { body { padding: 20px; } }
                </style></head><body>`;
                html += `<div class="header"><div class="logo"><img src="${LOGO_URI}" alt="Esprit Padel" /></div><div class="header-info"><h1>${eu.firstName} ${eu.lastName}</h1><p>${eu.role} — Bilan annuel ${evalPeriod}</p></div><div class="avg-box"><div class="score" style="color:${avg !== "—" ? ratingColors[Math.round(Number(avg))] : "#CBD5E1"}">${avg}/5</div><div class="label">Moyenne générale</div></div></div>`;
                EVAL_CATEGORIES.forEach(cat => {
                  const ca = getCatAvg(eu.id, cat.id);
                  html += `<div class="category"><h2>${cat.name} <span>${ca}/5</span></h2><table>`;
                  cat.criteria.forEach(cr => {
                    const v = ev[cr.id] || 0;
                    let dots = "";
                    for (let n = 1; n <= 5; n++) dots += `<span class="dot ${v >= n ? "r" + n : "empty"}">${n}</span>`;
                    const lb = v > 0 ? ratingLabels[v] : "Non noté";
                    html += `<tr><td>${cr.label}</td><td><span class="rating">${dots}</span></td><td><span class="label-text ${v > 0 ? "l" + v : ""}">${lb}</span></td></tr>`;
                  });
                  html += `</table></div>`;
                });
                html += `<div class="comments"><h3>💬 Commentaires & objectifs</h3>`;
                html += `<div class="comment-block"><label>Points forts</label><p>${ev.strengths || "—"}</p></div>`;
                html += `<div class="comment-block"><label>Axes d'amélioration</label><p>${ev.improvements || "—"}</p></div>`;
                html += `<div class="comment-block"><label>Objectifs prochaine période</label><p>${ev.goals || "—"}</p></div></div>`;
                html += `<div class="footer">Esprit Padel Communication — Évaluation générée le ${new Date().toLocaleDateString("fr-FR")}</div>`;
                html += `</body></html>`;
                downloadAsPdf(html);
              }} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#0F56B8", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
                📄 Télécharger l'évaluation en PDF
              </button>
              <button onClick={() => { const mailto = `mailto:${eu.email || ""}?subject=${encodeURIComponent(`Évaluation ${evalPeriod} — ${eu.firstName} ${eu.lastName}`)}&body=${encodeURIComponent(`Bonjour ${eu.firstName},\n\nVeuillez trouver votre évaluation annuelle ${evalPeriod} ci-jointe.\n\nCordialement,\nEsprit Padel Communication`)}`; window.open(mailto); }} style={{ padding: "10px 20px", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "#fff", color: "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
                📧 Envoyer par email
              </button>
            </div>
          </div>)}
        </div>);
      })()}
      {/* Historique */}
      {tab === "activity" && isAdmin && (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📜 Historique d'activité</div>
          {(activityLog || []).length === 0 ? <div style={{ fontSize: 12, color: "#94A3B8" }}>Aucune activité enregistrée</div> : (activityLog || []).slice(0, 50).map(a => {
            const u = users.find(x => String(x.id) === String(a.userId));
            return (<div key={a.id} style={{ display: "flex", gap: 8, padding: "8px 0", borderBottom: "1px solid #F1F5F9", fontSize: 12 }}>
              <span style={{ color: "#94A3B8", fontFamily: "JetBrains Mono, monospace", fontSize: 10, width: 60, flexShrink: 0 }}>{a.time ? new Date(a.time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
              <span style={{ fontWeight: 600, color: "#0F56B8", width: 70, flexShrink: 0 }}>{u?.firstName || "?"}</span>
              <span style={{ color: "#2D2D30" }}>{a.action}</span>
            </div>);
          })}
        </Card>
      )}

      {/* Compétences */}
      {/* Send Notification */}
      {tab === "sendnotif" && isAdmin && (
        <Card style={{ padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📢 Envoyer une notification</div>
          <Textarea label="Message" value={notifMsg} onChange={v => setNotifMsg(v)} rows={3} />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>Destinataires</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {[{ id: "all", label: "👥 Tous" }, { id: "club", label: "🏢 Par club" }, { id: "role", label: "👤 Par rôle" }, { id: "user", label: "🎯 Individuel" }].map(t => (
                <button key={t.id} onClick={() => setNotifTarget(t.id)} style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${notifTarget === t.id ? "#0F56B8" : "#E2E8F0"}`, background: notifTarget === t.id ? "#0F56B815" : "transparent", color: notifTarget === t.id ? "#0F56B8" : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t.label}</button>
              ))}
            </div>
            {notifTarget === "club" && <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{clubs.map(c => (<button key={c.id} onClick={() => setNotifClub(c.id)} style={{ padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${notifClub === c.id ? c.color : "#E2E8F0"}`, background: notifClub === c.id ? c.color + "15" : "transparent", color: notifClub === c.id ? c.color : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{c.name}</button>))}</div>}
            {notifTarget === "role" && <Select label="Rôle" value={notifRole} onChange={v => setNotifRole(v)} options={notifRoles.map(r => ({ value: r, label: r }))} />}
            {notifTarget === "user" && <Select label="Utilisateur" value={notifUser} onChange={v => setNotifUser(v)} options={users.filter(u => String(u.id) !== String(currentUserId)).map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))} />}
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 10 }}>📤 {getNotifTargetUsers().length} destinataire(s) : {getNotifTargetUsers().map(u => u.firstName).join(", ") || "—"}</div>
          <Btn onClick={sendNotifAction}>📢 Envoyer</Btn>
          {notifSent && <div style={{ marginTop: 8, padding: "6px 12px", borderRadius: 8, background: "#F0FDF4", color: "#10B981", fontSize: 12, fontWeight: 600 }}>✅ Notification envoyée !</div>}
        </Card>
      )}

      {tab === "competences" && isAdmin && (
        <CompetencesPage competences={competences} setCompetences={setCompetences} users={users} currentUserId={currentUserId} isAdmin={isAdmin} addToast={addToast} />
      )}

      {/* Pages */}
      {tab === "pages" && isAdmin && (
        <PageBuilder customPages={customPages} setCustomPages={setCustomPages} users={users} addToast={addToast} />
      )}
    </div>
  );
}

// ==================== COMPETENCES (Skill matrix - admin) ====================
function CompetencesPage({ competences, setCompetences, users, currentUserId, isAdmin, addToast }) {
  const [modal, setModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [skillForm, setSkillForm] = useState({ name: "", category: "Communication" });
  const [filterUser, setFilterUser] = useState(null);

  const skills = competences?.skills || [];
  const userProgress = competences?.userProgress || {};
  const CATEGORIES = ["Communication", "Réseaux sociaux", "Technique", "Management", "Création"];
  const LEVELS = [
    { value: 0, label: "Non évalué", color: "#E2E8F0" },
    { value: 1, label: "Débutant", color: "#EF4444" },
    { value: 2, label: "Intermédiaire", color: "#F59E0B" },
    { value: 3, label: "Confirmé", color: "#0F56B8" },
    { value: 4, label: "Expert", color: "#10B981" },
  ];
  const getLevel = (v) => LEVELS.find(l => l.value === v) || LEVELS[0];

  const openNewSkill = () => { setEditingSkill(null); setSkillForm({ name: "", category: "Communication" }); setModal(true); };
  const openEditSkill = (s) => { setEditingSkill(s.id); setSkillForm({ name: s.name, category: s.category }); setModal(true); };
  const saveSkill = () => {
    if (!skillForm.name.trim()) return;
    if (editingSkill) {
      setCompetences(p => ({ ...p, skills: (p.skills || []).map(s => String(s.id) === String(editingSkill) ? { ...s, ...skillForm } : s) }));
      addToast({ title: `Compétence modifiée : ${skillForm.name}`, icon: "🏅" });
    } else {
      setCompetences(p => ({ ...p, skills: [...(p.skills || []), { id: uid(), ...skillForm }] }));
      addToast({ title: `Nouvelle compétence : ${skillForm.name}`, icon: "🏅" });
    }
    setModal(false);
  };
  const delSkill = (id) => {
    if (!window.confirm("Supprimer cette compétence ? Toutes les évaluations associées seront perdues.")) return;
    setCompetences(p => {
      const newUserProgress = {};
      Object.keys(p.userProgress || {}).forEach(uid2 => {
        const { [id]: _removed, ...rest } = p.userProgress[uid2] || {};
        newUserProgress[uid2] = rest;
      });
      return { skills: (p.skills || []).filter(s => String(s.id) !== String(id)), userProgress: newUserProgress };
    });
  };

  const setUserLevel = (userId, skillId, level) => {
    setCompetences(p => ({
      ...p,
      userProgress: {
        ...(p.userProgress || {}),
        [userId]: { ...((p.userProgress || {})[userId] || {}), [skillId]: level }
      }
    }));
  };

  const getUserLevel = (userId, skillId) => (userProgress[userId] || {})[skillId] || 0;
  const getUserAverage = (userId) => {
    if (skills.length === 0) return 0;
    const total = skills.reduce((sum, s) => sum + getUserLevel(userId, s.id), 0);
    return Math.round((total / skills.length) * 10) / 10;
  };

  const displayUsers = filterUser ? users.filter(u => String(u.id) === String(filterUser)) : users;
  const byCategory = CATEGORIES.map(cat => ({ cat, items: skills.filter(s => s.category === cat) })).filter(g => g.items.length > 0);
  const uncategorized = skills.filter(s => !CATEGORIES.includes(s.category));

  if (!isAdmin) return <div style={{ padding: 30, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Accès réservé à l'administrateur</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>🏅 Compétences de l'équipe</h3>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{skills.length} compétence(s) suivie(s) · {users.length} membre(s)</div>
        </div>
        <Btn onClick={openNewSkill} small>+ Nouvelle compétence</Btn>
      </div>

      {skills.length === 0 ? (
        <Card style={{ padding: 30, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏅</div>
          <div style={{ fontSize: 13, color: "#6B7280" }}>Aucune compétence définie. Créez-en une pour commencer à évaluer l'équipe.</div>
        </Card>
      ) : (
        <>
          {/* Filter by user */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => setFilterUser(null)} style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${!filterUser ? "#0F56B8" : "#E2E8F0"}`, background: !filterUser ? "#0F56B810" : "transparent", color: !filterUser ? "#0F56B8" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Toute l'équipe</button>
            {users.map(u => (
              <button key={u.id} onClick={() => setFilterUser(String(u.id))} style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${String(filterUser) === String(u.id) ? "#0F56B8" : "#E2E8F0"}`, background: String(filterUser) === String(u.id) ? "#0F56B810" : "transparent", color: String(filterUser) === String(u.id) ? "#0F56B8" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{u.firstName} {u.lastName}</button>
            ))}
          </div>

          {/* Average per user */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginBottom: 20 }}>
            {displayUsers.map(u => {
              const avg = getUserAverage(u.id);
              const lvl = getLevel(Math.round(avg));
              return (
                <Card key={u.id} style={{ padding: 12, borderTop: `3px solid ${lvl.color}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Avatar name={`${u.firstName} ${u.lastName}`} size={28} color="#6366F1" />
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#2D2D30", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.firstName} {u.lastName}</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: lvl.color }}>{avg}<span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 400 }}> / 4</span></div>
                  <div style={{ fontSize: 10, color: lvl.color, fontWeight: 600 }}>{lvl.label}</div>
                </Card>
              );
            })}
          </div>

          {/* Skill matrix by category */}
          {[...byCategory, ...(uncategorized.length ? [{ cat: "Autres", items: uncategorized }] : [])].map(group => (
            <div key={group.cat} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30", marginBottom: 8 }}>{group.cat}</div>
              {group.items.map(skill => (
                <Card key={skill.id} style={{ padding: 14, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#2D2D30" }}>{skill.name}</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => openEditSkill(skill)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>✏️</button>
                      <button onClick={() => delSkill(skill.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#EF4444" }}>🗑️</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {displayUsers.map(u => {
                      const lvl = getUserLevel(u.id, skill.id);
                      return (
                        <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 120, fontSize: 11, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{u.firstName} {u.lastName}</div>
                          <div style={{ display: "flex", gap: 3, flex: 1 }}>
                            {LEVELS.map(l => (
                              <button
                                key={l.value}
                                onClick={() => setUserLevel(u.id, skill.id, l.value)}
                                title={l.label}
                                style={{ flex: 1, height: 22, borderRadius: 5, border: "none", cursor: "pointer", background: lvl >= l.value && l.value > 0 ? l.color : "#F1F5F9", opacity: lvl === l.value || (lvl >= l.value && l.value > 0) ? 1 : 0.5, transition: "all .15s" }}
                              />
                            ))}
                          </div>
                          <div style={{ width: 80, fontSize: 10, fontWeight: 600, color: getLevel(lvl).color, flexShrink: 0, textAlign: "right" }}>{getLevel(lvl).label}</div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          ))}
        </>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editingSkill ? "Modifier la compétence" : "Nouvelle compétence"}>
        <Input label="Nom de la compétence" value={skillForm.name} onChange={v => setSkillForm(p => ({ ...p, name: v }))} placeholder="Ex: Création de visuels Canva" />
        <Select label="Catégorie" value={skillForm.category} onChange={v => setSkillForm(p => ({ ...p, category: v }))} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
        <Btn onClick={saveSkill}>{editingSkill ? "Enregistrer" : "Créer"}</Btn>
      </Modal>
    </div>
  );
}


function TeamTrackingPage({ users, clubs, currentUser, currentUserId, isAdmin, onlineUsers }) {
  const [viewClub, setViewClub] = useState(null);
  
  // Directors see only their club members, admin sees all
  const myClubs = isAdmin ? clubs : clubs.filter(c => (currentUser?.clubs || []).some(uc => String(uc) === String(c.id)));
  const teamMembers = users.filter(u => {
    if (isAdmin) return String(u.id) !== String(currentUserId);
    return String(u.id) !== String(currentUserId) && (u.clubs || []).some(cid => (currentUser?.clubs || []).some(uc => String(uc) === String(cid)));
  }).filter(u => !viewClub || (u.clubs || []).some(uc => String(uc) === String(viewClub)));

  const isOnline = (uid2) => onlineUsers?.[uid2] && (Date.now() - onlineUsers[uid2]) < 60000;
  const getLastSeen = (uid2) => { const t = onlineUsers?.[uid2]; if (!t) return "Jamais connecté"; const diff = Math.floor((Date.now() - t) / 60000); if (diff < 1) return "En ligne"; if (diff < 60) return `Il y a ${diff}min`; if (diff < 1440) return `Il y a ${Math.floor(diff/60)}h`; return `Il y a ${Math.floor(diff/1440)}j`; };

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
      <div><h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>👥 Suivi équipe</h2><div style={{ fontSize: 12, color: "#6B7280" }}>Suivi des timers, vacances, école et examens</div></div>
    </div>

    {/* Club filter */}
    {myClubs.length > 1 && (<div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
      <button onClick={() => setViewClub(null)} style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${!viewClub ? "#0F56B8" : "#E2E8F0"}`, background: !viewClub ? "#0F56B810" : "transparent", color: !viewClub ? "#0F56B8" : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Tous</button>
      {myClubs.map(c => (<button key={c.id} onClick={() => setViewClub(viewClub === c.id ? null : c.id)} style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${viewClub === c.id ? c.color : "#E2E8F0"}`, background: viewClub === c.id ? c.color + "10" : "transparent", color: viewClub === c.id ? c.color : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{c.name}</button>))}
    </div>)}

    {teamMembers.length === 0 ? (
      <Card style={{ padding: 30, textAlign: "center" }}><div style={{ fontSize: 13, color: "#6B7280" }}>Aucun membre dans votre équipe</div></Card>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {teamMembers.map(u => {
          const online = isOnline(u.id);
          return (
            <Card key={u.id} style={{ padding: 16, borderLeft: `4px solid ${online ? "#10B981" : "#CBD5E1"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ position: "relative" }}>
                    <Avatar name={`${u.firstName} ${u.lastName}`} size={40} color={["#6366F1","#EC4899","#10B981","#F59E0B"][u.id % 4]} />
                    <span style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: online ? "#10B981" : "#CBD5E1", border: "2px solid #fff" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#2D2D30" }}>{u.firstName} {u.lastName}</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{u.role}</div>
                    <div style={{ fontSize: 10, color: online ? "#10B981" : "#94A3B8" }}>{getLastSeen(u.id)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {(u.clubs || []).map(cid => { const c = clubs.find(x => String(x.id) === String(cid)); return c ? <span key={cid} style={{ padding: "2px 8px", borderRadius: 6, background: c.color + "15", color: c.color, fontSize: 10, fontWeight: 600 }}>{c.name}</span> : null; })}
                </div>
              </div>

              {/* Vacations */}
              {(u.vacations || []).length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>🏖️ Vacances</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {u.vacations.map(v => <span key={v.id} style={{ padding: "3px 8px", borderRadius: 6, background: "#10B98115", color: "#10B981", fontSize: 10, fontWeight: 600 }}>Du {v.from} au {v.to}</span>)}
                  </div>
                </div>
              )}

              {/* Days off */}
              {u.daysOff && Object.keys(u.daysOff).some(d => u.daysOff[d]) && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>📅 Jours de congé</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {Object.keys(u.daysOff).filter(d => u.daysOff[d]).map(d => <span key={d} style={{ padding: "2px 8px", borderRadius: 6, background: "#EF444415", color: "#EF4444", fontSize: 10, fontWeight: 600 }}>{d}</span>)}
                  </div>
                </div>
              )}

              {/* School days - alternants only */}
              {u.schoolDays && Object.keys(u.schoolDays).some(d => u.schoolDays[d]) && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>🎓 Jours d'école</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {Object.keys(u.schoolDays).filter(d => u.schoolDays[d]).map(d => <span key={d} style={{ padding: "2px 8px", borderRadius: 6, background: "#6366F115", color: "#6366F1", fontSize: 10, fontWeight: 600 }}>{d} 🎓</span>)}
                  </div>
                </div>
              )}

              {/* School weeks */}
              {(u.schoolWeeks || []).length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>📚 Semaines d'école</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {u.schoolWeeks.map(sw => <span key={sw.id} style={{ padding: "2px 8px", borderRadius: 6, background: "#6366F115", color: "#6366F1", fontSize: 10, fontWeight: 600 }}>{sw.from} → {sw.to}{sw.label ? ` (${sw.label})` : ""}</span>)}
                  </div>
                </div>
              )}

              {/* Exams */}
              {(u.exams || []).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>📝 Examens</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {u.exams.map(ex => <span key={ex.id} style={{ padding: "2px 8px", borderRadius: 6, background: "#EF444415", color: "#EF4444", fontSize: 10, fontWeight: 600 }}>{ex.date} — {ex.label}</span>)}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    )}
  </div>);
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "◻" },
  { id: "objectives", label: "Objectifs", icon: "🎯" },
  { id: "todo", label: "Tâches", icon: "☑" },
  { id: "projects", label: "Projets", icon: "📂" },
  { id: "reporting", label: "Reporting", icon: "📊" },
  { id: "metricool-approvals", label: "Validations Metricool", icon: "M", adminOnly: true },
  { id: "calendar", label: "Calendrier", icon: "📅" },
  { id: "drive", label: "Drive", icon: "📁" },
  { id: "tournaments", label: "Tournois", icon: "🏆" },
  { id: "elearning", label: "E-Learning", icon: "🎓" },
  { id: "templates", label: "Templates", icon: "📋" },
  { id: "veille", label: "Veille", icon: "🔍" },
  { id: "campaigns", label: "Campagnes", icon: "📢" },
  { id: "surveys", label: "Sondages", icon: "📊" },
  { id: "directory", label: "Répertoire", icon: "👥" },
  { id: "profile", label: "Mon profil", icon: "👤" },
];

// ==================== PAGE BUILDER ====================
const BLOCK_TYPES = [
  { type: "heading", label: "Titre", icon: "📝", default: { text: "Nouveau titre", level: 1 } },
  { type: "text", label: "Texte", icon: "📄", default: { text: "Votre texte ici..." } },
  { type: "image", label: "Image", icon: "🖼️", default: { url: "", caption: "" } },
  { type: "link", label: "Lien", icon: "🔗", default: { url: "", label: "Cliquez ici" } },
  { type: "divider", label: "Séparateur", icon: "➖", default: {} },
  { type: "list", label: "Liste", icon: "📋", default: { items: ["Item 1", "Item 2", "Item 3"] } },
  { type: "embed", label: "Vidéo/Embed", icon: "🎬", default: { url: "" } },
  { type: "alert", label: "Alerte/Info", icon: "ℹ️", default: { text: "Information importante", color: "#0F56B8" } },
  { type: "spacer", label: "Espace", icon: "⬜", default: { height: 40 } },
];

function PageBuilder({ customPages, setCustomPages, users, addToast }) {
  const [editingPage, setEditingPage] = useState(null);
  const [pageForm, setPageForm] = useState({ title: "", icon: "📄", description: "", visibleTo: "all", published: false, blocks: [] });
  const [dragIdx, setDragIdx] = useState(null);

  const createPage = () => {
    const newPage = { id: uid(), ...pageForm, createdAt: new Date().toISOString() };
    setCustomPages(p => [...p, newPage]);
    addToast({ title: `Page créée : ${newPage.title}`, icon: "🧩", badges: ["Page"], target: "pagebuilder" });
    setEditingPage(null);
    setPageForm({ title: "", icon: "📄", description: "", visibleTo: "all", published: false, blocks: [] });
  };

  const savePage = () => {
    setCustomPages(p => p.map(pg => String(pg.id) === String(editingPage) ? { ...pg, ...pageForm } : pg));
    addToast({ title: `Page modifiée : ${pageForm.title}`, icon: "✏️", badges: ["Page"], target: "pagebuilder" });
  };

  const deletePage = (id) => {
    if (!window.confirm("Supprimer cette page ?")) return;
    setCustomPages(p => p.filter(pg => String(pg.id) !== String(id)));
    if (editingPage === id) setEditingPage(null);
  };

  const openEdit = (pg) => {
    setEditingPage(pg.id);
    setPageForm({ title: pg.title, icon: pg.icon || "📄", description: pg.description || "", visibleTo: pg.visibleTo || "all", published: pg.published || false, blocks: pg.blocks || [] });
  };

  const addBlock = (type) => {
    const bt = BLOCK_TYPES.find(b => b.type === type);
    setPageForm(p => ({ ...p, blocks: [...p.blocks, { id: uid(), type, ...JSON.parse(JSON.stringify(bt.default)) }] }));
  };

  const updateBlock = (idx, data) => setPageForm(p => ({ ...p, blocks: p.blocks.map((b, i) => i === idx ? { ...b, ...data } : b) }));
  const removeBlock = (idx) => setPageForm(p => ({ ...p, blocks: p.blocks.filter((_, i) => i !== idx) }));
  const moveBlock = (from, to) => {
    if (to < 0 || to >= pageForm.blocks.length) return;
    setPageForm(p => { const b = [...p.blocks]; const item = b.splice(from, 1)[0]; b.splice(to, 0, item); return { ...p, blocks: b }; });
  };

  const renderBlockEditor = (block, idx) => {
    const s = { padding: 12, background: "#F4F2EF", borderRadius: 10, marginBottom: 8, border: dragIdx === idx ? "2px solid #0F56B8" : "1.5px solid #E2E8F0" };
    return (
      <div key={block.id} style={s} draggable onDragStart={() => setDragIdx(idx)} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragIdx !== null && dragIdx !== idx) moveBlock(dragIdx, idx); setDragIdx(null); }} onDragEnd={() => setDragIdx(null)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", cursor: "grab" }}>☰ {BLOCK_TYPES.find(b => b.type === block.type)?.icon} {BLOCK_TYPES.find(b => b.type === block.type)?.label}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => moveBlock(idx, idx - 1)} disabled={idx === 0} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: idx === 0 ? "#CBD5E1" : "#6B7280" }}>▲</button>
            <button onClick={() => moveBlock(idx, idx + 1)} disabled={idx === pageForm.blocks.length - 1} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: idx === pageForm.blocks.length - 1 ? "#CBD5E1" : "#6B7280" }}>▼</button>
            <button onClick={() => removeBlock(idx)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#EF4444" }}>✕</button>
          </div>
        </div>
        {block.type === "heading" && <><input value={block.text} onChange={e => updateBlock(idx, { text: e.target.value })} style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }} /><select value={block.level || 1} onChange={e => updateBlock(idx, { level: Number(e.target.value) })} style={{ marginTop: 4, padding: "4px 8px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 11, fontFamily: "inherit" }}><option value={1}>H1 — Grand titre</option><option value={2}>H2 — Sous-titre</option><option value={3}>H3 — Petit titre</option></select></>}
        {block.type === "text" && <textarea value={block.text} onChange={e => updateBlock(idx, { text: e.target.value })} rows={3} style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />}
        {block.type === "image" && <><input value={block.url} onChange={e => updateBlock(idx, { url: e.target.value })} placeholder="URL de l'image" style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", marginBottom: 4, boxSizing: "border-box" }} /><input value={block.caption || ""} onChange={e => updateBlock(idx, { caption: e.target.value })} placeholder="Légende (optionnel)" style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }} /></>}
        {block.type === "link" && <><input value={block.url} onChange={e => updateBlock(idx, { url: e.target.value })} placeholder="URL" style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", marginBottom: 4, boxSizing: "border-box" }} /><input value={block.label} onChange={e => updateBlock(idx, { label: e.target.value })} placeholder="Texte du lien" style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }} /></>}
        {block.type === "list" && <textarea value={(block.items || []).join("\n")} onChange={e => updateBlock(idx, { items: e.target.value.split("\n") })} rows={3} placeholder="Un item par ligne" style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />}
        {block.type === "embed" && <input value={block.url} onChange={e => updateBlock(idx, { url: e.target.value })} placeholder="URL YouTube ou embed" style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }} />}
        {block.type === "alert" && <><input value={block.text} onChange={e => updateBlock(idx, { text: e.target.value })} style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", marginBottom: 4, boxSizing: "border-box" }} /><div style={{ display: "flex", gap: 4 }}>{["#0F56B8", "#10B981", "#F59E0B", "#EF4444"].map(c => <button key={c} onClick={() => updateBlock(idx, { color: c })} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: block.color === c ? "3px solid #2D2D30" : "2px solid transparent", cursor: "pointer" }} />)}</div></>}
        {block.type === "spacer" && <input type="range" min={10} max={100} value={block.height || 40} onChange={e => updateBlock(idx, { height: Number(e.target.value) })} style={{ width: "100%" }} />}
      </div>
    );
  };

  // Page list view
  if (!editingPage && !pageForm.title) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>🧩 Créateur de pages</h2>
          <Btn onClick={() => setPageForm({ title: "Nouvelle page", icon: "📄", description: "", visibleTo: "all", published: false, blocks: [] })}>+ Nouvelle page</Btn>
        </div>
        {customPages.length === 0 ? <Card style={{ padding: 30, textAlign: "center" }}><div style={{ fontSize: 32, marginBottom: 8 }}>🧩</div><div style={{ fontSize: 13, color: "#6B7280" }}>Aucune page créée. Cliquez sur "+ Nouvelle page" pour commencer.</div></Card> : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {customPages.map(pg => (
              <Card key={pg.id} style={{ cursor: "pointer" }} onClick={() => openEdit(pg)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div><div style={{ fontSize: 16, marginBottom: 4 }}>{pg.icon || "📄"} <span style={{ fontWeight: 700, fontSize: 14 }}>{pg.title}</span></div><div style={{ fontSize: 11, color: "#6B7280" }}>{pg.description || "Pas de description"}</div><div style={{ display: "flex", gap: 4, marginTop: 6 }}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: pg.published ? "#10B98120" : "#F59E0B20", color: pg.published ? "#10B981" : "#F59E0B", fontWeight: 600 }}>{pg.published ? "Publiée" : "Brouillon"}</span><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "#F1F5F9", color: "#6B7280" }}>{(pg.blocks || []).length} blocs</span></div></div>
                  <button onClick={e => { e.stopPropagation(); deletePage(pg.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#CBD5E1" }} onMouseEnter={e => e.currentTarget.style.color = "#EF4444"} onMouseLeave={e => e.currentTarget.style.color = "#CBD5E1"}>🗑️</button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Page editor
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><button onClick={() => { setEditingPage(null); setPageForm({ title: "", icon: "📄", description: "", visibleTo: "all", published: false, blocks: [] }); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#6B7280" }}>←</button><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{editingPage ? "Modifier la page" : "Nouvelle page"}</h2></div>
        <div style={{ display: "flex", gap: 8 }}>{editingPage && <Btn onClick={savePage}>💾 Enregistrer</Btn>}{!editingPage && <Btn onClick={createPage} disabled={!pageForm.title}>Créer la page</Btn>}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        {/* Left: block editor */}
        <div>
          <Card style={{ marginBottom: 14, padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, marginBottom: 12 }}>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>Icône</label><input value={pageForm.icon} onChange={e => setPageForm(p => ({ ...p, icon: e.target.value }))} style={{ width: 40, padding: "6px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 18, textAlign: "center", fontFamily: "inherit" }} /></div>
              <Input label="Titre de la page" value={pageForm.title} onChange={v => setPageForm(p => ({ ...p, title: v }))} />
            </div>
            <Input label="Description" value={pageForm.description} onChange={v => setPageForm(p => ({ ...p, description: v }))} />
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="checkbox" checked={pageForm.published} onChange={e => setPageForm(p => ({ ...p, published: e.target.checked }))} style={{ accentColor: "#10B981" }} /><span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Publiée (visible dans le menu)</span></label>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 6 }}>Visible par</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => setPageForm(p => ({ ...p, visibleTo: "all" }))} style={{ padding: "4px 12px", borderRadius: 8, border: `1.5px solid ${pageForm.visibleTo === "all" ? "#0F56B8" : "#E2E8F0"}`, background: pageForm.visibleTo === "all" ? "#0F56B810" : "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, color: pageForm.visibleTo === "all" ? "#0F56B8" : "#6B7280", fontFamily: "inherit" }}>👥 Tous</button>
                {users.map(u => (
                  <button key={u.id} onClick={() => setPageForm(p => { const cur = Array.isArray(p.visibleTo) ? p.visibleTo : []; return { ...p, visibleTo: cur.includes(u.id) ? cur.filter(x => x !== u.id) : [...cur, u.id] }; })} style={{ padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${Array.isArray(pageForm.visibleTo) && pageForm.visibleTo.includes(u.id) ? "#0F56B8" : "#E2E8F0"}`, background: Array.isArray(pageForm.visibleTo) && pageForm.visibleTo.includes(u.id) ? "#0F56B810" : "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, color: Array.isArray(pageForm.visibleTo) && pageForm.visibleTo.includes(u.id) ? "#0F56B8" : "#6B7280", fontFamily: "inherit" }}>{u.firstName}</button>
                ))}
              </div>
            </div>
          </Card>
          {/* Block list */}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30", marginBottom: 8 }}>Blocs ({pageForm.blocks.length})</div>
          {pageForm.blocks.length === 0 && <Card style={{ padding: 20, textAlign: "center", marginBottom: 10 }}><span style={{ fontSize: 12, color: "#94A3B8" }}>Ajoutez des blocs depuis le panneau de droite →</span></Card>}
          {pageForm.blocks.map((block, idx) => renderBlockEditor(block, idx))}
        </div>
        {/* Right: block palette */}
        <div>
          <Card style={{ padding: 14, position: "sticky", top: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2D2D30", marginBottom: 10 }}>Ajouter un bloc</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {BLOCK_TYPES.map(bt => (
                <button key={bt.type} onClick={() => addBlock(bt.type)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", fontFamily: "inherit", transition: "all .12s" }} onMouseEnter={e => { e.currentTarget.style.background = "#F4F2EF"; e.currentTarget.style.borderColor = "#0F56B8"; }} onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#E2E8F0"; }}>
                  <span style={{ fontSize: 16 }}>{bt.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#2D2D30" }}>{bt.label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Custom page viewer
function CustomPageView({ page, currentUserId, isAdmin }) {
  const renderBlock = (block) => {
    switch (block.type) {
      case "heading": return <div style={{ fontSize: block.level === 1 ? 24 : block.level === 2 ? 20 : 16, fontWeight: 700, color: "#2D2D30", margin: "16px 0 8px" }}>{block.text}</div>;
      case "text": return <div style={{ fontSize: 14, lineHeight: 1.8, color: "#2D2D30", whiteSpace: "pre-wrap", margin: "8px 0" }}>{block.text}</div>;
      case "image": return <div style={{ margin: "12px 0", textAlign: "center" }}>{block.url && <img src={block.url} alt={block.caption || ""} style={{ maxWidth: "100%", borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,.1)" }} />}{block.caption && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>{block.caption}</div>}</div>;
      case "link": return <a href={block.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "#0F56B810", color: "#0F56B8", fontWeight: 600, fontSize: 13, textDecoration: "none", margin: "8px 0" }}>🔗 {block.label}</a>;
      case "divider": return <hr style={{ border: "none", borderTop: "1.5px solid #E2E8F0", margin: "16px 0" }} />;
      case "list": return <ul style={{ paddingLeft: 20, margin: "8px 0" }}>{(block.items || []).map((item, i) => <li key={i} style={{ fontSize: 13, lineHeight: 1.8, color: "#2D2D30" }}>{item}</li>)}</ul>;
      case "embed": return <div style={{ margin: "12px 0", borderRadius: 10, overflow: "hidden" }}>{block.url && <iframe src={block.url.replace("watch?v=", "embed/")} style={{ width: "100%", height: 300, border: "none" }} title="embed" />}</div>;
      case "alert": return <div style={{ padding: "12px 16px", borderRadius: 10, background: (block.color || "#0F56B8") + "10", borderLeft: `4px solid ${block.color || "#0F56B8"}`, fontSize: 13, color: "#2D2D30", margin: "10px 0" }}>{block.text}</div>;
      case "spacer": return <div style={{ height: block.height || 40 }} />;
      default: return null;
    }
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}><span style={{ fontSize: 28 }}>{page.icon || "📄"}</span><div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{page.title}</h2>{page.description && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{page.description}</div>}</div></div>
      <Card style={{ padding: 24, maxWidth: 800 }}>
        {(page.blocks || []).length === 0 ? <div style={{ textAlign: "center", padding: 20, color: "#94A3B8" }}>Cette page est vide</div> : (page.blocks || []).map((block, i) => <div key={block.id || i}>{renderBlock(block)}</div>)}
      </Card>
    </div>
  );
}

export default function EspritPadelCommunication() {
  // ── PUBLIC SURVEY RESPONSE MODE (no login required) ──────────────────
  const [surveyUrlId] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("sondage"); } catch { return null; }
  });
  if (surveyUrlId) {
    return <PublicSurveyPage surveyId={surveyUrlId} />;
  }

  // ── Firebase Auth (Phase 2.1) — hook toujours appelé, flag contrôle l'usage ──
  const { firebaseUser, appId: fbAppId, authLoading } = useAuth();

  const [loggedIn, setLoggedIn] = useState(() => {
    if (USE_FIREBASE_AUTH) return false; // Firebase gère la session — pas de restauration localStorage
    try { return localStorage.getItem("ep_loggedIn") === "true"; } catch { return false; }
  });
  const [currentUserId, setCurrentUserId] = useState(() => {
    if (USE_FIREBASE_AUTH) return null;
    try { return localStorage.getItem("ep_userId") || null; } catch { return null; }
  });
  const [loginEmail, setLoginEmail] = useState(() => { try { return localStorage.getItem("ep_rememberEmail") || ""; } catch { return ""; } });
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginForgot, setLoginForgot] = useState(false);
  const [loginForgotSent, setLoginForgotSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => { try { return localStorage.getItem("ep_remember") === "true"; } catch { return false; } });

  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  useEffect(() => {
    // Inject viewport meta for mobile
    if (!document.querySelector('meta[name="viewport"]')) {
      const meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
      document.head.appendChild(meta);
    }
    const check = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      setIsTablet(w >= 768 && w < 1024);
      if (w < 768) setSidebarOpen(false);
      else if (w < 1024) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  // ===== SYNCED SHARED DATA =====
  const [clubs, setClubs] = useSyncState("ep:clubs", INITIAL_CLUBS);
  const [users, setUsers, usersFirestoreReady] = useSyncState("ep:users", initialUsers);
  const [objectives, setObjectives] = useSyncState("ep:objectives", initialObjectives);
  const [tasks, setTasks] = useSyncState("ep:tasks", initialTasks);
  const [requests, setRequests] = useSyncState("ep:requests", []);
  const [meetings, setMeetings] = useSyncState("ep:meetings", initialMeetings);
  const [slots, setSlots] = useSyncState("ep:slots", initialSlots);
  const [projects, setProjects] = useSyncState("ep:projects", initialProjects);
  const [publications, setPublications] = useSyncState("ep:publications", initialPublications);
  const [reportingData, setReportingData] = useSyncState("ep:reporting", initialReportingData);
  const metricoolApprovals = useFirestoreValue("ep:metricool-approvals", null);
  const [documents, setDocuments] = useSyncState("ep:documents", initialDocuments);
  const [folders, setFolders] = useSyncState("ep:folders", initialFolders);
  const [photoAlbums, setPhotoAlbums] = useSyncState("ep:albums", initialPhotoAlbums);
  const [drivePhotos, setDrivePhotos] = useSyncState("ep:photos", initialPhotos);
  const [calendarEvents, setCalendarEvents] = useSyncState("ep:events", initialCalendarEvents);
  const [tournaments, setTournaments] = useSyncState("ep:tournaments", initialTournaments);
  const [userNotes, setUserNotes] = useSyncState("ep:notes", []);
  const INITIAL_ELEARNING = [
    { id: "identite", icon: "🏟️", title: "Identité du Club", category: "Fondamentaux", duration: "15 min", description: "Connaître l'ADN d'Esprit Padel La Boisse", lessons: [
      { title: "Le club en bref", content: "**Esprit Padel La Boisse** est un club indoor de 7 terrains (dont le Terrain 7 Fréquence). Son identité repose sur 3 piliers : **Familial — Fun — Accessible**.\n\nLe club propose un restaurant, un bar, des animations régulières, et une vraie communauté (afterworks, événements, etc.).\n\nCompte Instagram : @espritpadel_la_boisse", keyPoints: ["Indoor — 7 terrains", "Familial, Fun, Accessible", "Restaurant + Bar + Animations", "Communauté & Afterworks"] },
      { title: "Les 5 objectifs clés", content: "Toute action de communication doit servir au moins un de ces 5 axes :\n\n**1. Communauté** — Créer un sentiment d'appartenance\n**2. Fidélisation** — Donner envie de revenir\n**3. Interactions** — Générer des réactions et du partage\n**4. Services** — Valoriser bar, resto, pro-shop\n**5. Notoriété** — Devenir LA référence locale padel", keyPoints: ["Communauté & Appartenance", "Fidélisation", "Interactions", "Services (bar, resto, pro-shop)", "Notoriété locale"] },
      { title: "Publics cibles", content: "4 publics à toujours garder en tête :\n\n🎾 **Passionnés** — Jeu, performance, compétition\n👨‍👩‍👧‍👦 **Familles** — Convivialité, moments ensemble\n🏢 **Entreprises** — Team building, événements corporate\n📱 **Influenceurs** — Visibilité, partenariats", keyPoints: ["Passionnés (jeu, perf)", "Familles (convivialité)", "Entreprises (team building)", "Influenceurs (visibilité)"] }
    ], quiz: [
      { q: "Combien de terrains possède Esprit Padel La Boisse ?", options: ["5", "6", "7", "8"], correct: 2 },
      { q: "Quel est le nom du Terrain 7 ?", options: ["Sensation", "Fréquence", "Performance", "Impact"], correct: 1 },
      { q: "Lequel n'est PAS un des 5 objectifs clés ?", options: ["Communauté", "Fidélisation", "Rentabilité", "Notoriété"], correct: 2 },
      { q: "Quel public cible est associé au team building ?", options: ["Passionnés", "Familles", "Entreprises", "Influenceurs"], correct: 2 },
      { q: "Quel mot ne décrit PAS l'identité du club ?", options: ["Familial", "Fun", "Élitiste", "Accessible"], correct: 2 }
    ], scores: {} },
    { id: "journee1", icon: "📸", title: "Journée Type 1", category: "Opérationnel", duration: "20 min", description: "Terrain, Observation & Contenu — vivre le club et produire", lessons: [
      { title: "Avant de commencer", content: "Chaque journée terrain commence par 3 réflexes :\n\n1. **Relire les objectifs SMART** du moment\n2. **Lire les messages internes** (infos équipe)\n3. **Observer le club** : affluence, énergie, ambiance", keyPoints: ["Objectifs SMART", "Messages internes", "Observer affluence & énergie"] },
      { title: "Club physique", content: "Sur place, tu es les yeux de la com :\n\n📋 **Affichages** — Mise à jour chaque lundi\n🔗 **Cohérence** — Vérifier que les infos club = infos réseaux\n🎯 **Temps forts** — Identifier les moments à capturer", keyPoints: ["MAJ affichages chaque lundi", "Cohérence club / réseaux", "Repérer les temps forts"] },
      { title: "Stories (priorité !)", content: "Les stories sont ta priorité quotidienne :\n\n☀️ **Ouverture du club** — Ambiance du matin\n🎾 **Terrains** — Matchs, échanges, points\n🍽️ **Bar / Resto** — Convivialité\n📋 **Menu du jour** — Photo plat ou ardoise\nℹ️ **Infos events** — Animation du moment\n\n💡 Règle d'or : **Simple, spontané, pas de montage lourd**", keyPoints: ["Ouverture club", "Terrains & matchs", "Bar/resto", "Menu du jour", "Events", "Simple & spontané"] },
      { title: "Création & publication", content: "📷 **Création de contenu**\n- Photos joueurs sur les terrains\n- Vidéos courtes 15-60s (rires, points)\n- Capturer les moments forts\n- Tout sauvegarder sur le Drive\n\n📤 **Publication**\n- Programmer les posts via Metricool\n- Répondre aux DM en moins de 2h (ton amical)\n- Commenter sur tous les réseaux", keyPoints: ["Photos joueurs", "Vidéos 15-60s", "Sauvegarde Drive", "Programmer via Metricool", "DM < 2h", "Commenter partout"] }
    ], quiz: [
      { q: "Quand faut-il mettre à jour les affichages du club ?", options: ["Chaque jour", "Chaque lundi", "Chaque vendredi", "Chaque mois"], correct: 1 },
      { q: "Quel est le délai max pour répondre aux DM ?", options: ["30 min", "1h", "2h", "4h"], correct: 2 },
      { q: "Quelle durée idéale pour les vidéos courtes ?", options: ["5-10s", "15-60s", "1-3 min", "3-5 min"], correct: 1 },
      { q: "Quel outil sert à programmer les posts ?", options: ["Canva", "Asana", "Metricool", "Matchpoint"], correct: 2 },
      { q: "Quelle est la règle d'or des stories ?", options: ["Montage pro", "Simple et spontané", "Filtre obligatoire", "Texte long"], correct: 1 }
    ], scores: {} },
    { id: "journee2", icon: "📋", title: "Journée Type 2", category: "Opérationnel", duration: "20 min", description: "Organisation, Anticipation & Respiration", lessons: [
      { title: "Tri & Création", content: "C'est le moment de faire le ménage :\n\n🗂️ **Trier** photos/vidéos de la semaine\n🗑️ **Supprimer** l'inutile, garder le meilleur\n🎨 **Créer** des contenus adaptés à l'objectif en cours", keyPoints: ["Trier photos/vidéos", "Supprimer l'inutile", "Créer selon l'objectif"] },
      { title: "Rédaction & programmation", content: "📝 **Rédaction (sam/dim)**\n- Descriptions pour la semaine suivante\n- Ton fun + tutoiement\n- CTA clair dans chaque post\n\n📅 **Metricool**\n- Posts en brouillon\n- Vérifier dates & heures\n- Anticipation 3 mois : J5=tournois, J15=animations\n\n✅ **Asana**\n- Liste contenus à produire\n- Formats & dates renseignés\n- Commentaires si besoin", keyPoints: ["Ton fun + tutoiement", "CTA dans chaque post", "Brouillons Metricool", "Anticiper 3 mois", "Todo Asana"] },
      { title: "Anticipation & To-do récurrentes", content: "🔮 **Anticipation 3 mois**\n- Jours fériés à venir\n- Absences équipe\n- Messages adaptés fermeture/horaires\n- Stories info si changement\n\n📌 **To-do récurrentes**\n- 🟡 Vendredi : Message Paula/Stéphane\n- 🔵 Samedi : Rédiger captions\n- 🟢 Lundi : Affichage + point + contenu\n- 🔴 Quotidien : Stories + contenu", keyPoints: ["Anticiper jours fériés", "Gérer absences", "Message vendredi tuteurs", "Captions samedi", "Affichage lundi"] },
      { title: "Les 4 règles d'or", content: "Ces règles résument l'état d'esprit à adopter :\n\n✨ **Anticiper > Subir** — Toujours avoir un coup d'avance\n📝 **Brouillon > Retard** — Mieux vaut un brouillon qu'un post en retard\n👀 **Observer > Mesurer** — Ressentir avant d'analyser\n😊 **Plaisir > Pression** — La com doit rester un kiff", keyPoints: ["Anticiper > Subir", "Brouillon > Retard", "Observer > Mesurer", "Plaisir > Pression"] }
    ], quiz: [
      { q: "Quel jour faut-il envoyer un message à Paula/Stéphane ?", options: ["Lundi", "Mercredi", "Vendredi", "Dimanche"], correct: 2 },
      { q: "Sur combien de mois faut-il anticiper ?", options: ["1 mois", "2 mois", "3 mois", "6 mois"], correct: 2 },
      { q: "Que faut-il faire le samedi ?", options: ["Publier les posts", "Rédiger les captions", "Trier les photos", "Mettre à jour Asana"], correct: 1 },
      { q: "Complète : Brouillon > ...", options: ["Perfection", "Retard", "Qualité", "Pression"], correct: 1 },
      { q: "Quel outil gère la liste des contenus à produire ?", options: ["Metricool", "Canva", "Asana", "Matchpoint"], correct: 2 }
    ], scores: {} },
    { id: "editorial", icon: "✍️", title: "Ligne Éditoriale", category: "Créatif", duration: "15 min", description: "Ton, style et types de contenus", lessons: [
      { title: "À faire / À éviter", content: "✅ **À FAIRE :**\n- Fun, familial, chaleureux\n- Montrer les gens, les valoriser\n- Humour léger, naturel\n- Contenu vivant, spontané\n- Tutoiement sur les réseaux\n- CTA clair dans chaque post\n\n❌ **À ÉVITER :**\n- Trop institutionnel\n- Posts froids, sans émotion\n- Trop de texte\n- Trop de promos (max 20%)", keyPoints: ["Fun & chaleureux", "Valoriser les gens", "Tutoiement", "CTA systématique", "Max 20% promos"] },
      { title: "Types de contenus", content: "🏆 **Tournois** — Annonce, live, résultats\n📸 **Photos joueurs** — Avant/après\n🎬 **Vidéos terrain** — Points, ambiance\n🍹 **Coulisses** — Bar, équipe, rires\n🎉 **Vie du club** — Afterworks, enfants\n\n💡 Règle absolue : **Imparfait mais régulier > Parfait mais rare**", keyPoints: ["Tournois", "Photos joueurs", "Vidéos terrain", "Coulisses", "Vie du club", "Régularité > Perfection"] }
    ], quiz: [
      { q: "Quel pourcentage max de contenu promo est recommandé ?", options: ["10%", "15%", "20%", "30%"], correct: 2 },
      { q: "Quel ton utiliser sur les réseaux ?", options: ["Vouvoiement", "Tutoiement", "Langage soutenu", "Jargon technique"], correct: 1 },
      { q: "Complète : Imparfait mais régulier > ...", options: ["Parfait mais rare", "Bon mais lent", "Rapide mais nul", "Pro mais froid"], correct: 0 },
      { q: "Lequel est un type de contenu recommandé ?", options: ["Communiqués de presse", "Coulisses bar/équipe", "Analyses financières", "Comparatifs concurrents"], correct: 1 }
    ], scores: {} },
    { id: "stories", icon: "📱", title: "Guide Stories", category: "Créatif", duration: "15 min", description: "Les règles visuelles pour des stories pro", lessons: [
      { title: "Les 5 règles stories", content: "1. **Contenu** — Photo/vidéo sur le moment. Repartage possible.\n2. **Encadrement** — Cadre officiel Esprit Padel (pré-téléchargé, sans fond, centré)\n3. **Typographies** — DECO et SQUEEZE uniquement. Aucune autre police.\n4. **Couleurs** — Roue couleur > Pipette > Couleur des carrés du cadre\n5. **Règle finale** — Pas de surcharge. Cadre, polices, couleurs. C'est tout.", keyPoints: ["Cadre officiel centré", "Polices DECO & SQUEEZE uniquement", "Couleurs du cadre via pipette", "Pas de surcharge"] },
      { title: "Stories quotidiennes", content: "Planning stories du jour :\n\n☀️ **Ouverture du club** — Matin → Donner le ton\n🎾 **Terrains** — En continu → Meilleurs points\n🍽️ **Ambiance bar/resto** — Midi/soir → Convivialité\n📋 **Menu du jour** — 11h-12h → Photo plat ou ardoise\nℹ️ **Info event/tournoi** — Selon actu → Teasing, annonce", keyPoints: ["Ouverture = matin", "Terrains = continu", "Bar/resto = midi/soir", "Menu = 11h-12h", "Events = selon actu"] }
    ], quiz: [
      { q: "Quelles sont les 2 seules polices autorisées en stories ?", options: ["Arial & Helvetica", "DECO & SQUEEZE", "Montserrat & Roboto", "Impact & Comic Sans"], correct: 1 },
      { q: "Comment choisir la couleur du texte en story ?", options: ["Au feeling", "Pipette sur les carrés du cadre", "Toujours blanc", "Code hex officiel"], correct: 1 },
      { q: "À quelle heure publier la story menu du jour ?", options: ["9h-10h", "11h-12h", "13h-14h", "15h-16h"], correct: 1 },
      { q: "Quelle est la règle finale des stories ?", options: ["Maximum d'effets", "Pas de surcharge", "Toujours un sondage", "Musique obligatoire"], correct: 1 }
    ], scores: {} },
    { id: "push", icon: "🔔", title: "Push Notifications", category: "Outils", duration: "10 min", description: "Matchpoint — Informer les clients des dispos", lessons: [
      { title: "Procédure d'envoi", content: "7 étapes pour envoyer une push notification Matchpoint :\n\n1. **Web & Réseau** → Menu principal Matchpoint\n2. **Publication d'actualités** → Sous-menu Contenu portail\n3. **Rechercher** → Taper 'dispo' ou 'disponible'\n4. **Choisir publication** → Stylo vert pour éditer\n5. **Modifier titre + contenu** selon les règles\n6. **Sauvegarder** → Mettre à jour (OBLIGATOIRE)\n7. **Envoyer** → Notifier aux téléphones\n\n⚠️ Après l'envoi, Matchpoint sera inutilisable quelques instants.", keyPoints: ["7 étapes précises", "Chercher 'dispo'", "Stylo vert = éditer", "Sauvegarder OBLIGATOIRE", "Matchpoint bloqué après envoi"] },
      { title: "Règles de rédaction push", content: "6 règles pour une push efficace :\n\n1. **Date entre crochets** — [Vendredi 22 janvier]\n2. **Call To Action** — Pousser à réserver\n3. **Priorité heures pleines** — Indiquer les créneaux\n4. **Titre court** — Moins de 2 lignes\n5. **Terrain + sponsor** — Ex: Terrain 7 Fréquence\n6. **Lien hypertexte** — Toujours conserver", keyPoints: ["Date entre crochets", "CTA = réserver", "Heures pleines prioritaires", "Titre < 2 lignes", "Terrain + sponsor", "Lien hypertexte"] }
    ], quiz: [
      { q: "Quel mot chercher pour trouver la publication à modifier ?", options: ["terrain", "dispo", "push", "urgent"], correct: 1 },
      { q: "Comment formater la date dans une push ?", options: ["En gras", "Entre parenthèses", "Entre crochets", "Souligné"], correct: 2 },
      { q: "Que se passe-t-il après l'envoi d'une push ?", options: ["Rien", "Matchpoint est inutilisable quelques instants", "Le post est supprimé", "Un email est envoyé"], correct: 1 },
      { q: "Combien de lignes max pour le titre d'une push ?", options: ["1", "2", "3", "4"], correct: 1 }
    ], scores: {} },
    { id: "whatsapp", icon: "💬", title: "Rédaction WhatsApp", category: "Outils", duration: "15 min", description: "Les 4 règles d'or & modèles copier-coller", lessons: [
      { title: "Les 4 Règles d'Or", content: "1. **L'Accroche Visuelle** (Emoji + Gras) — Le premier mot doit stopper le scrolling. Emojis alertes : 🔥 ⚡ 🚨\n2. **Aller à l'essentiel** (Skimmable) — Pas de longs paragraphes. Listes à puces pour les horaires.\n3. **L'Appel à l'Action** (CTA) direct — Dis exactement quoi faire.\n4. **Le sentiment d'exclusivité** (FOMO) — Fais sentir que le créneau va partir vite.", keyPoints: ["Emojis alertes 🔥 ⚡ 🚨", "Skimmable = listes à puces", "CTA = quoi faire exactement", "FOMO = urgence & exclusivité"] },
      { title: "Modèle : Dernière Minute", content: "🚨 DERNIÈRE MINUTE ! 🚨\nUn terrain vient de se libérer pour CE SOIR à 19h00 ! 🔥\nC'est le créneau roi, il ne va pas rester longtemps.\n👉 Réserve tout de suite sur l'application : Premier arrivé, premier servi ! 🎾\n\n💡 Pourquoi ça marche : emojis alertes + urgence temporelle + CTA direct + FOMO", keyPoints: ["Urgence maximale", "Combler un trou le jour même", "Emojis 🚨 + 🔥", "Premier arrivé, premier servi"] },
      { title: "Modèle : Planning Week-end", content: "☀️ Padel ce week-end ?\nLa météo est top, c'est le moment de jouer ! Il nous reste quelques places :\nSamedi : ✅ 10h00 - 11h30 ✅ 14h00 - 15h30\nDimanche : ✅ 09h00 ✅ 17h00\n📲 Bloque ton terrain sur l'application !\nBon match à tous ! VAMOS ! 💪\n\n💡 Ton décontracté + liste claire des créneaux + CTA + énergie positive", keyPoints: ["Ton décontracté & sympa", "Liste claire des créneaux", "Adapter à la météo", "Finir avec énergie (VAMOS)"] },
      { title: "Modèle : Créneau Prime Time", content: "⚡ ALERTE CRÉNEAU EN OR ⚡\nC'est rare, mais on a une dispo demain à 20h00 !\nQui est assez rapide pour le prendre ? 😎\n👇 Direction l'application pour réserver : Vamos!\n\n💡 Rareté + défi + FOMO naturel", keyPoints: ["Créneau 18h-21h = prime time", "Jouer sur la rareté", "Créer un défi", "FOMO naturel"] },
      { title: "Modèle : Recherche Joueur", content: "🆘 SOS PADEL\nIl manque 1 joueur pour un match ce soir à 18h30 ! Niveau intermédiaire.\nC'est l'occasion de rencontrer de nouveaux partenaires. 🤝\nRéponds 'Moi' à ce message si tu es chaud ! 🔥\n\n💡 Esprit communautaire + CTA ultra simple ('Moi') + valorisation du lien social", keyPoints: ["Esprit communautaire", "Préciser le niveau", "CTA simple : répondre 'Moi'", "Valoriser la rencontre"] },
      { title: "Astuces Techniques", content: "Formatages WhatsApp :\n\n**Gras** : entourer d'astérisques → *19h00*\n_Italique_ : entourer d'underscores → _Premier arrivé_\n~Barré~ : entourer de tildes → ~20h00~ (créneau pris)\n\n💡 Astuce pro : Mets toujours en gras les éléments clés pour que le message soit lisible en 3 secondes.", keyPoints: ["*gras* = astérisques", "_italique_ = underscores", "~barré~ = tildes", "Gras sur horaires & infos clés", "Lisible en 3 secondes"] }
    ], quiz: [
      { q: "Quels emojis sont recommandés pour l'accroche ?", options: ["😊 👍 ❤️", "🔥 ⚡ 🚨", "🎾 🏆 ⭐", "📱 💬 📩"], correct: 1 },
      { q: "Que signifie FOMO ?", options: ["Format Officiel de Message Online", "Fear Of Missing Out", "Fiche Opérationnelle Marketing", "Fun Or Minus One"], correct: 1 },
      { q: "Quel modèle pour un terrain libéré le jour même ?", options: ["Planning week-end", "Créneau prime time", "Dernière minute", "Recherche joueur"], correct: 2 },
      { q: "Quel CTA ultra simple dans le modèle Recherche Joueur ?", options: ["Clique ici", "Répondre 'Moi'", "Appelle-nous", "Partage ce message"], correct: 1 },
      { q: "Comment barrer du texte sur WhatsApp ?", options: ["--texte--", "~~texte~~", "~texte~", "##texte##"], correct: 2 },
      { q: "Que représente un créneau Prime Time ?", options: ["6h-9h", "12h-14h", "18h-21h", "22h-00h"], correct: 2 },
      { q: "Quel est le principe de Skimmable ?", options: ["Tout en gras", "Listes à puces, pas de longs paragraphes", "Uniquement des emojis", "Texte très long"], correct: 1 },
      { q: "Pourquoi utiliser le barré ~texte~ ?", options: ["Pour décorer", "Montrer qu'un créneau est pris", "Pour l'italique", "Pour le titre"], correct: 1 }
    ], scores: {} },
    { id: "tournois", icon: "🏆", title: "Calendrier Tournois", category: "Événements", duration: "15 min", description: "Règles de communication événementielle", lessons: [
      { title: "Règles du calendrier", content: "5 règles pour le calendrier tournois :\n\n1. **Toujours le même template**\n2. **Mois en MAJUSCULES** (ex: MARS)\n3. **Jour en lettres + 2 chiffres**\n4. **Catégorie en GRAS + MAJUSCULES**\n5. **Public en dessous, PAS gras**\n\nCouleurs officielles par catégorie : P25, P50, P100, P250, P500, P1000, P1500, LOISIR\nAucune autre couleur ne doit être utilisée.", keyPoints: ["Même template toujours", "Mois en MAJUSCULES", "Catégorie GRAS + MAJUSCULES", "Couleurs strictes par catégorie"] },
      { title: "Communication événements", content: "Chaque événement a 3 phases de communication :\n\n**AVANT** : Post + Stories teasing, Annonce, inscription\n**PENDANT** : Stories live, Matchs, bar, résultats\n**APRÈS** : Photos, résultats, Podium, remerciements\n\n💡 Règle : **1 événement = minimum 5 à 10 stories**", keyPoints: ["3 phases avant/pendant/après", "Teasing avant", "Live pendant", "Résultats après", "5-10 stories minimum"] }
    ], quiz: [
      { q: "Comment écrire le mois dans le calendrier tournois ?", options: ["En minuscules", "Première lettre majuscule", "En MAJUSCULES", "Abrégé"], correct: 2 },
      { q: "Combien de stories minimum par événement ?", options: ["1 à 2", "3 à 5", "5 à 10", "10 à 20"], correct: 2 },
      { q: "Que fait-on APRÈS un événement ?", options: ["Rien", "Supprimer les stories", "Photos, résultats, podium", "Changer le template"], correct: 2 },
      { q: "La catégorie du tournoi s'écrit comment ?", options: ["En italique", "En minuscules", "GRAS + MAJUSCULES", "Souligné"], correct: 2 }
    ], scores: {} },
    { id: "seo", icon: "🔍", title: "SEO & Visibilité Digitale", category: "Digital", duration: "30 min", description: "Maîtriser le référencement et la visibilité en ligne", lessons: [
      { title: "Les bases du SEO", content: "Le SEO (Search Engine Optimization) est l'ensemble des techniques pour améliorer la visibilité d'un site sur les moteurs de recherche.\n\n**3 piliers du SEO :**\n1. **Technique** : vitesse du site, mobile-friendly, HTTPS, sitemap\n2. **Contenu** : mots-clés, qualité, régularité, balises H1/H2\n3. **Popularité** : backlinks, partages sociaux, Google My Business\n\n💡 Google analyse +200 facteurs pour classer un site.", keyPoints: ["3 piliers : Technique, Contenu, Popularité", "Vitesse et mobile-friendly sont essentiels", "+200 facteurs de classement Google", "HTTPS obligatoire"] },
      { title: "Mots-clés & Contenu", content: "Les mots-clés sont les termes que les gens tapent dans Google.\n\n**Comment les choisir :**\n- Utiliser Google Suggest (autocomplétion)\n- Analyser avec Google Trends\n- Outils : Ubersuggest, Answer The Public, SEMrush\n\n**Où les placer :**\n- Titre de la page (balise title)\n- Titres H1, H2, H3\n- Premier paragraphe\n- URL\n- Alt des images\n- Meta description\n\n**Règle d'or : 1 page = 1 mot-clé principal**\n\nPour un club de padel : \"cours padel Lyon\", \"tournoi padel La Boisse\", \"réservation terrain padel\"", keyPoints: ["1 page = 1 mot-clé principal", "Placer dans titre, H1, URL, alt images", "Google Suggest pour trouver les mots-clés", "Outils : Ubersuggest, SEMrush, Google Trends"] },
      { title: "Google My Business", content: "Google My Business (GMB) est **CRUCIAL** pour un club de sport local.\n\n**Optimiser votre fiche :**\n1. Nom exact du club\n2. Adresse et horaires à jour\n3. Photos de qualité (minimum 10)\n4. Catégorie : \"Club de padel\" ou \"Centre sportif\"\n5. Description avec mots-clés locaux\n\n**Les avis Google :**\n- Répondre à TOUS les avis (positifs et négatifs)\n- Demander des avis aux adhérents\n- Objectif : 4.5+ étoiles\n\n**Posts Google :**\n- Publier 1x/semaine minimum\n- Événements, promotions, actualités\n- Inclure un CTA (appel à l'action)\n\n💡 Un club avec 50+ avis apparaît 3x plus dans les résultats locaux.", keyPoints: ["Photos de qualité (min 10)", "Répondre à tous les avis", "Objectif 4.5+ étoiles", "Poster 1x/semaine minimum", "CTA dans chaque post"] },
      { title: "Réseaux sociaux & SEO", content: "Les réseaux sociaux n'impactent pas directement le SEO mais :\n\n**Impact indirect :**\n- Génèrent du trafic vers le site\n- Augmentent la notoriété de marque\n- Créent des signaux sociaux\n- Favorisent les backlinks naturels\n\n**Bonnes pratiques :**\n- Lien vers le site dans la bio\n- Hashtags locaux (#PadelLyon #PadelFrance)\n- Partager les articles du blog\n- Stories avec lien (swipe up)\n\n**SEO YouTube :**\n- Titre avec mot-clé\n- Description détaillée\n- Tags pertinents\n- Miniature accrocheuse\n- Sous-titres\n\n💡 Une vidéo YouTube bien optimisée peut apparaître en 1ère page Google.", keyPoints: ["Lien site dans la bio", "Hashtags locaux", "YouTube = SEO vidéo", "Partager articles du blog"] },
      { title: "Mesurer ses résultats", content: "**Outils de mesure :**\n- Google Analytics : trafic, sources, comportement\n- Google Search Console : positions, clics, impressions\n- Metricool : réseaux sociaux\n- PageSpeed Insights : vitesse du site\n\n**KPIs à suivre :**\n- Position moyenne des mots-clés\n- Trafic organique mensuel\n- Taux de rebond\n- Nombre de pages vues\n- Taux de conversion\n- Nombre d'avis Google\n\n**Fréquence :** Rapport mensuel minimum\n\n💡 Le SEO prend du temps : 3 à 6 mois pour voir des résultats significatifs.", keyPoints: ["Google Analytics + Search Console", "Rapport mensuel minimum", "3-6 mois pour voir des résultats", "Suivre positions, trafic, conversions"] }
    ], quiz: [
      { q: "Quels sont les 3 piliers du SEO ?", options: ["Design, Code, Marketing", "Technique, Contenu, Popularité", "Facebook, Instagram, TikTok", "Vitesse, Images, Vidéos"], correct: 1 },
      { q: "Combien de facteurs Google analyse-t-il ?", options: ["10", "50", "100", "+200"], correct: 3 },
      { q: "La règle d'or du contenu SEO ?", options: ["1 page = 5 mots-clés", "1 page = 1 mot-clé principal", "Pas de mots-clés", "Répéter 100 fois le mot-clé"], correct: 1 },
      { q: "Objectif d'étoiles sur Google My Business ?", options: ["3+", "3.5+", "4+", "4.5+"], correct: 3 },
      { q: "Combien de temps pour voir des résultats SEO ?", options: ["1 semaine", "1 mois", "3-6 mois", "2 ans"], correct: 2 },
      { q: "Quel outil mesure les positions Google ?", options: ["Instagram Insights", "Google Search Console", "Canva", "WhatsApp"], correct: 1 },
      { q: "Combien de photos minimum sur Google My Business ?", options: ["1", "3", "5", "10"], correct: 3 },
      { q: "Que faut-il inclure dans chaque post Google ?", options: ["Un emoji", "Un CTA", "Un hashtag", "Un lien YouTube"], correct: 1 }
    ], scores: {} },
    { id: "legal", icon: "⚖️", title: "Lois & Communication Digitale", category: "Juridique", duration: "25 min", description: "RGPD, droits d'auteur et règles de la communication en ligne", lessons: [
      { title: "RGPD — Les fondamentaux", content: "Le RGPD (Règlement Général sur la Protection des Données) est en vigueur depuis mai 2018.\n\n**Ce qu'il impose :**\n1. **Consentement explicite** : l'utilisateur doit accepter activement\n2. **Droit d'accès** : toute personne peut demander ses données\n3. **Droit à l'oubli** : suppression des données sur demande\n4. **Portabilité** : l'utilisateur peut récupérer ses données\n5. **Notification de fuite** : 72h pour signaler une violation\n\n**Pour un club de padel :**\n- Formulaire d'inscription : case à cocher pour le consentement\n- Newsletter : opt-in obligatoire + lien de désinscription\n- Photos/vidéos : droit à l'image des personnes filmées\n- Fichier adhérents : sécurisé et déclaré\n\n⚠️ Amende : jusqu'à 4% du CA ou 20M€", keyPoints: ["Consentement explicite obligatoire", "Droit d'accès et droit à l'oubli", "72h pour signaler une fuite", "Amende jusqu'à 20M€ ou 4% du CA"] },
      { title: "Droit à l'image", content: "En France, toute personne a un **droit exclusif sur son image**.\n\n**Règles pour les photos/vidéos :**\n- Obtenir l'autorisation AVANT de publier\n- Pour les mineurs : autorisation des 2 parents\n- Exception : foule lors d'un événement public (plan large)\n- Pas d'exception pour les réseaux sociaux\n\n**Bonnes pratiques club :**\n- Clause droit à l'image dans l'inscription\n- Panneau à l'entrée informant de la prise de photos\n- Pour les stories : demander avant de filmer quelqu'un\n- Si quelqu'un demande le retrait : supprimer immédiatement\n\n**Modèle d'autorisation :**\nJe soussigné(e) [nom] autorise [club] à utiliser mon image dans le cadre de sa communication sur [supports]. Cette autorisation est accordée à titre gratuit pour une durée de [durée].\n\n⚠️ Sans autorisation = atteinte au droit à l'image = poursuites possibles", keyPoints: ["Autorisation AVANT publication", "Mineurs : autorisation des 2 parents", "Exception : plan large événement public", "Retrait immédiat sur demande"] },
      { title: "Droits d'auteur & Propriété intellectuelle", content: "Tout contenu (texte, image, musique, vidéo) est protégé par le droit d'auteur dès sa création.\n\n**Ce qui est interdit :**\n- Reprendre une photo Google Images sans licence\n- Utiliser une musique commerciale en story/reel\n- Copier le texte d'un autre site\n- Utiliser le logo d'une marque sans accord\n\n**Musiques libres de droits :**\n- Bibliothèque audio YouTube\n- Musiques proposées par Instagram/TikTok (droits inclus)\n- Epidemic Sound, Artlist (abonnement)\n- Attention : libre de droits ≠ gratuit\n\n**Images libres de droits :**\n- Unsplash, Pexels, Pixabay (gratuites)\n- Shutterstock, Adobe Stock (payantes)\n- Toujours vérifier la licence\n\n**Canva :** Les éléments Canva Pro sont utilisables commercialement, mais pas revendables.", keyPoints: ["Toute création est protégée automatiquement", "Musiques Instagram/TikTok = droits inclus", "Unsplash/Pexels = images gratuites libres", "Canva Pro = usage commercial OK"] },
      { title: "Publicité en ligne & Mentions légales", content: "**Règles de la publicité :**\n- Toute pub doit être identifiable comme telle\n- Mention \"Sponsorisé\" ou \"Publicité\" obligatoire\n- Pas de publicité mensongère ou trompeuse\n- Alcool : loi Évin (interdiction de valoriser la consommation)\n\n**Influenceurs & Partenariats :**\n- Mention #pub #ad #sponsorisé obligatoire\n- Depuis 2023 : loi influenceurs renforcée\n- Interdiction de promouvoir : chirurgie esthétique, paris sportifs (pour les mineurs), produits contrefaits\n\n**Jeux concours :**\n- Règlement déposé chez un huissier (ou en ligne)\n- Conditions de participation claires\n- Pas d'obligation d'achat pour participer\n- Mention \"Règlement complet sur [lien]\"\n\n**Mentions légales site web :**\n- Nom/raison sociale, adresse, SIRET\n- Directeur de publication\n- Hébergeur\n- Politique de confidentialité", keyPoints: ["Mention Sponsorisé obligatoire", "Loi Évin pour l'alcool", "#pub #ad obligatoire pour influenceurs", "Jeux concours : règlement obligatoire"] },
      { title: "Newsletter & Emailing", content: "**Règles RGPD pour l'emailing :**\n1. **Opt-in** : consentement actif (pas de case pré-cochée)\n2. **Lien de désinscription** : obligatoire dans chaque email\n3. **Identité de l'expéditeur** : claire et visible\n4. **Objet non trompeur** : refléter le contenu\n\n**Ce qui est interdit :**\n- Acheter des listes d'emails\n- Envoyer sans consentement préalable\n- Masquer le lien de désinscription\n- Continuer d'envoyer après désinscription\n\n**Bonnes pratiques :**\n- Double opt-in recommandé (email de confirmation)\n- Segmenter les listes (adhérents, prospects)\n- Fréquence raisonnable (pas plus d'1x/semaine)\n- Tester avant d'envoyer (objet, liens, images)\n\n💡 Taux d'ouverture moyen dans le sport : 25-30%\n💡 Meilleurs jours : mardi et jeudi", keyPoints: ["Opt-in actif obligatoire", "Lien de désinscription dans chaque email", "Double opt-in recommandé", "Pas plus d'1 email/semaine"] }
    ], quiz: [
      { q: "Depuis quand le RGPD est-il en vigueur ?", options: ["2015", "2016", "2018", "2020"], correct: 2 },
      { q: "Délai pour signaler une fuite de données ?", options: ["24h", "48h", "72h", "1 semaine"], correct: 2 },
      { q: "Pour filmer un mineur, il faut :", options: ["Son accord verbal", "L'accord d'un parent", "L'accord des 2 parents", "Rien"], correct: 2 },
      { q: "Peut-on utiliser une photo de Google Images ?", options: ["Oui toujours", "Oui si on cite la source", "Non sauf licence", "Oui si c'est pour un club"], correct: 2 },
      { q: "Mention obligatoire sur un post sponsorisé ?", options: ["#merci", "#partenariat", "#pub ou #ad", "#gratuit"], correct: 2 },
      { q: "Une case pré-cochée pour la newsletter est :", options: ["Recommandée", "Obligatoire", "Interdite par le RGPD", "Facultative"], correct: 2 },
      { q: "Amende maximale RGPD ?", options: ["10 000€", "100 000€", "1M€", "20M€ ou 4% du CA"], correct: 3 },
      { q: "Les musiques proposées par Instagram sont :", options: ["Interdites en story", "Libres de droits dans l'app", "Payantes", "Réservées aux pro"], correct: 1 }
    ], scores: {} }
  ];
  const [elearningData, setElearningData] = useSyncState("ep:elearning", INITIAL_ELEARNING);
  const [toasts, setToasts] = useState([]);
  const todayDate = new Date().toLocaleDateString("fr-FR");
  const yesterdayDate = new Date(Date.now() - 86400000).toLocaleDateString("fr-FR");
  const [notifications, setNotifications] = useSyncState(currentUserId ? `ep:notifs_${currentUserId}` : null, []);
  const [personalPlans, setPersonalPlans] = useSyncState(currentUserId ? `ep:personalplanning_${currentUserId}` : null, []);

  // Track shown notification IDs to avoid duplicate toasts
  const shownNotifsRef = useRef(new Set());
  const prevNotifIdsRef = useRef(new Set());

  // Detect NEW notifications from useSyncState and show toast
  useEffect(() => {
    if (!loggedIn || !notifications || !Array.isArray(notifications)) return;
    const currentIds = new Set(notifications.map(n => n?.id).filter(Boolean));
    
    if (prevNotifIdsRef.current.size > 0) {
      const brandNew = notifications.filter(n => n?.id && !prevNotifIdsRef.current.has(n.id) && !shownNotifsRef.current.has(n.id));
      brandNew.forEach(n => {
        shownNotifsRef.current.add(n.id);
        // Show in-app toast for new notification
        setToasts(p => [...p, { id: n.id, title: n.title || "Nouvelle notification", icon: n.icon || "🔔" }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== n.id)), 5000);
      });
    } else {
      // First load - just mark all as known, don't show toasts
      notifications.forEach(n => { if (n?.id) shownNotifsRef.current.add(n.id); });
    }
    
    prevNotifIdsRef.current = currentIds;
  }, [notifications, loggedIn]);
  const [globalNotifs, setGlobalNotifs] = useSyncState("ep:globalnotifs", []);
  const [conversations, setConversations] = useSyncState("ep:conversations", initialConversations);
  const [hashtags, setHashtags] = useSyncState("ep:hashtags", []);
  const [templates, setTemplates] = useSyncState("ep:templates", []);
  const [templateCategories, setTemplateCategories] = useSyncState("ep:templatecats", []);
  const [briefs, setBriefs] = useSyncState("ep:briefs", []);
  const [veille, setVeille] = useSyncState("ep:veille", []);
  const [activityLog, setActivityLog] = useSyncState("ep:activitylog", []);
  const [customPages, setCustomPages] = useSyncState("ep:custompages", []);
  const [competences, setCompetences] = useSyncState("ep:competences", { skills: [], userProgress: {} });
  const [campagnes, setCampagnes] = useSyncState("ep:campagnes", []);
  const [surveys, setSurveys] = useSyncState("ep:surveys", []);
  const [surveyResponses, setSurveyResponses] = useSyncState("ep:surveyresponses", []);
  const [chatOpen, setChatOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useSyncState("ep:online", {});
  const [chronoRunning, setChronoRunning] = useState(false);
  const [chronoStart, setChronoStart] = useState(null);
  const [chronoElapsed, setChronoElapsed] = useState(0);
  const [chronoOpen, setChronoOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const searchRef = useRef(null);
  const chronoRef = useRef(null);
  const [chatLastRead, setChatLastRead] = useState(() => {
    const init = {};
    initialConversations.forEach(c => { init[c.id] = c.messages.length; });
    return init;
  });

  const chatUnreadCounts = useMemo(() => {
    const counts = {};
    conversations.forEach(c => {
      const lastRead = chatLastRead[c.id] || 0;
      const unread = c.messages.slice(lastRead).filter(m => m.userId !== currentUserId).length;
      counts[c.id] = unread;
    });
    return counts;
  }, [conversations, chatLastRead, currentUserId]);

  const totalUnread = Object.values(chatUnreadCounts).reduce((a, b) => a + b, 0);
  const markChatRead = useCallback((convId) => {
    setChatLastRead(p => {
      const c = conversations.find(x => String(x.id) === String(convId));
      return { ...p, [convId]: c ? c.messages.length : 0 };
    });
  }, [conversations]);

  // Chronometre
  useEffect(() => {
    if (chronoRunning) {
      chronoRef.current = setInterval(() => {
        setChronoElapsed(Math.floor((Date.now() - chronoStart) / 1000));
      }, 1000);
    } else {
      if (chronoRef.current) clearInterval(chronoRef.current);
    }
    return () => { if (chronoRef.current) clearInterval(chronoRef.current); };
  }, [chronoRunning, chronoStart]);

  const startChrono = () => { setChronoStart(Date.now()); setChronoElapsed(0); setChronoRunning(true); };
  const stopChrono = () => { setChronoRunning(false); };
  const resetChrono = () => { setChronoRunning(false); setChronoElapsed(0); setChronoStart(null); };
  const formatChrono = (s) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`; };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "k") { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 100); }
        return;
      }
      const shortcuts = { n: "todo", c: "calendar", d: "dashboard", p: "projects", o: "objectives", r: "reporting", t: "tournaments" };
      if (shortcuts[e.key]) { e.preventDefault(); setPage(shortcuts[e.key]); }
      if (e.key === "?" || e.key === "h") setShowHelp(p => !p);
      if (e.key === "Escape") { setSearchOpen(false); setShowHelp(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Search results
  const searchResults = useMemo(() => {
    if (!globalSearch.trim()) return [];
    const q = globalSearch.toLowerCase();
    const results = [];
    tasks.filter(t => t.title.toLowerCase().includes(q)).slice(0, 3).forEach(t => results.push({ type: "☑ Tâche", title: t.title, target: "todo" }));
    objectives.filter(o => o.title.toLowerCase().includes(q)).slice(0, 3).forEach(o => results.push({ type: "🎯 Objectif", title: o.title, target: "objectives" }));
    projects.filter(p => p.name.toLowerCase().includes(q)).slice(0, 3).forEach(p => results.push({ type: "📂 Projet", title: p.name, target: "projects" }));
    meetings.filter(m => m.title.toLowerCase().includes(q)).slice(0, 3).forEach(m => results.push({ type: "🤝 Réunion", title: m.title, target: "calendar" }));
    documents.filter(d => d.name.toLowerCase().includes(q)).slice(0, 3).forEach(d => results.push({ type: "📄 Document", title: d.name, target: "documents" }));
    tournaments.filter(t => t.title.toLowerCase().includes(q)).slice(0, 2).forEach(t => results.push({ type: "🏆 Tournoi", title: t.title, target: "tournaments" }));
    users.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(q)).slice(0, 2).forEach(u => results.push({ type: "👤 Utilisateur", title: `${u.firstName} ${u.lastName}`, target: "directory" }));
    return results;
  }, [globalSearch, tasks, objectives, projects, meetings, documents, tournaments, users]);

  const logActivity = useCallback((action) => {
    setActivityLog(p => [{ id: uid(), userId: currentUserId, action, time: new Date().toISOString() }, ...p].slice(0, 100));
  }, [currentUserId]);

  // Push notifications
  // FCM VAPID key (from Firebase Console → Project Settings → Cloud Messaging → Web Push)
  const VAPID_KEY = "BD_6JshpUTCH-IyDAKX1yUBEo1r3DOxtZ5C8oGccRA248zhGfQBnm2gSJX9RSt9SJwe-j2VdczsqZl_V0V4JAVg";
  const [fcmStatus, setFcmStatus] = useState("idle"); // idle | granted | denied | unsupported

  // Step 1: Register SW silently on login (no permission needed)
  useEffect(() => {
    if (!loggedIn) return;
    (async () => {
      try {
        if ("serviceWorker" in navigator) {
          await navigator.serviceWorker.register("/firebase-messaging-sw.js");
          await navigator.serviceWorker.ready;
        }
        // Check current permission state without prompting
        if ("Notification" in window) {
          setFcmStatus(Notification.permission === "granted" ? "granted" : Notification.permission === "denied" ? "denied" : "idle");
        } else {
          setFcmStatus("unsupported");
        }
      } catch {}
    })();
  }, [loggedIn]);

  // Step 2: If already granted, silently get token (no prompt)
  useEffect(() => {
    if (fcmStatus !== "granted" || !loggedIn || !currentUserId || !_fb_messaging) return;
    (async () => {
      try {
        const swReg = await navigator.serviceWorker.getRegistration();
        if (!swReg) return;
        const token = await getToken(_fb_messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
        if (token) {
          const tokenKey = `ep:fcmtokens_${currentUserId}`;
          const snap = await fbGetDoc(fbDoc(_fb_db, "appdata", tokenKey));
          const existing = snap.exists() ? (snap.data().tokens || []) : [];
          if (!existing.includes(token)) {
            await setDoc(fbDoc(_fb_db, "appdata", tokenKey), { tokens: [...existing, token].slice(-5), updatedAt: Date.now() });
          }
        }
      } catch {}
    })();
  }, [fcmStatus, loggedIn, currentUserId]);

  // Step 3: Request permission ONLY on user click (button)
  const requestPushPermission = useCallback(async () => {
    try {
      if (!("Notification" in window)) { setFcmStatus("unsupported"); return; }
      const permission = await Notification.requestPermission();
      setFcmStatus(permission === "granted" ? "granted" : "denied");
    } catch { setFcmStatus("denied"); }
  }, []);

  // Handle foreground FCM messages
  useEffect(() => {
    if (!_fb_messaging || !loggedIn) return;
    let unsub;
    try {
      unsub = onMessage(_fb_messaging, (payload) => {
        // FCM foreground message received - useSyncState will update the bell
        // No toast here to avoid duplicates
      });
    } catch {}
    return () => { if (unsub) unsub(); };
  }, [loggedIn]);

  const sendPushNotification = useCallback((title, body) => {
    // Foreground notification - FCM handles background
    try {
      if ("Notification" in window && Notification.permission === "granted" && document.visibilityState === "visible") {
        // Don't show browser notif in foreground, onMessage handles it
      }
    } catch {}
  }, []);

  // Online presence heartbeat
  useEffect(() => {
    if (!loggedIn) return;
    const beat = () => setOnlineUsers(p => ({ ...p, [currentUserId]: Date.now() }));
    beat();
    const iv = setInterval(beat, 30000);
    return () => { clearInterval(iv); setOnlineUsers(p => { const n = { ...p }; delete n[currentUserId]; return n; }); };
  }, [loggedIn, currentUserId, setOnlineUsers]);

  const isUserOnline = useCallback((uid2) => {
    const lastSeen = onlineUsers?.[uid2];
    return lastSeen && (Date.now() - lastSeen) < 60000;
  }, [onlineUsers]);

  const getLastSeen = useCallback((uid2) => {
    const lastSeen = onlineUsers?.[uid2];
    if (!lastSeen) return "Jamais connecté";
    const diff = Date.now() - lastSeen;
    if (diff < 60000) return "En ligne";
    if (diff < 3600000) return `Il y a ${Math.round(diff / 60000)} min`;
    if (diff < 86400000) return `Il y a ${Math.round(diff / 3600000)}h`;
    return `Il y a ${Math.round(diff / 86400000)}j`;
  }, [onlineUsers]);

  // Send notification to a specific user via Firestore
  const sentNotifsRef = useRef(new Set());
  const notifyUser = useCallback((targetUserId, notification, type = "general") => {
    if (!_fb_db) return;
    if (!targetUserId) return;
    // Dedup: don't send same notification title to same user within 5 seconds
    const dedupKey = `${targetUserId}_${notification.title || ""}`;
    if (sentNotifsRef.current.has(dedupKey)) return;
    sentNotifsRef.current.add(dedupKey);
    setTimeout(() => sentNotifsRef.current.delete(dedupKey), 5000);
    const now = new Date();
    const notif = {
      ...notification,
      id: uid(),
      type,
      time: now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      date: now.toLocaleDateString("fr-FR"),
      timestamp: now.getTime(),
      from: currentUserId,
    };
    const key = `ep:notifs_${targetUserId}`;
    (async () => {
      try {
        const snap = await fbGetDoc(fbDoc(_fb_db, "appdata", key));
        const current = snap.exists() ? (snap.data().value || []) : [];
        await setDoc(fbDoc(_fb_db, "appdata", key), { value: [notif, ...current].slice(0, 50), updatedAt: Date.now() });
      } catch (e) { console.error("notifyUser error:", e); }
    })();
  }, [currentUserId]);

  const addToast = useCallback((t, notifyUserIds) => {
    const id = uid();
    const now = new Date();
    const notif = {
      ...t, id,
      time: now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      date: now.toLocaleDateString("fr-FR"),
      timestamp: now.getTime(),
      from: currentUserId,
    };
    
    // Show local toast (temporary popup)
    setToasts(p => [...p, { ...t, id }]);
    setTimeout(() => setToasts(p => p.filter(x => String(x.id) !== String(id))), 5000);
    
    // Activity log
    setActivityLog(prev => [{ id, userId: currentUserId, action: t.title, time: now.toISOString() }, ...prev].slice(0, 100));
    
    if (notifyUserIds && notifyUserIds.length > 0) {
      // Cross-user: write to each target user's Firestore
      notifyUserIds.filter(uid2 => String(uid2) !== String(currentUserId)).forEach(uid2 => {
        notifyUser(uid2, notif, t.notifType || "general");
      });
    }
    // Self-notifications stay local only (no Firestore write, no push)
  }, [currentUserId, notifyUser]);
  const dismissToast = (id) => setToasts(p => p.filter(x => String(x.id) !== String(id)));

  // Deadline reminders (J-7, J-3, J-1, day of; background delivery is handled by Cloud Functions)
  const remindedRef = useRef({});
  useEffect(() => {
    if (!loggedIn) return;
    const check = () => {
      const today = new Date(); today.setHours(0,0,0,0);
      const checkDays = [0, 1, 3, 7];
      [...tasks, ...objectives].forEach(item => {
        if (!item.deadline || item.status === "Terminé" || item.status === "success") return;
        const isAssigned = (item.assignedTo || []).includes(currentUserId) || String(item.assigneeId) === String(currentUserId) || String(item.owner) === String(currentUserId);
        if (!isAssigned) return;
        const dl = new Date(item.deadline); dl.setHours(0,0,0,0);
        const diff = Math.round((dl - today) / 86400000);
        checkDays.forEach(d => {
          if (diff === d) {
            const key = `${item.id}_${d}_${today.toDateString()}`;
            if (remindedRef.current[key]) return;
            remindedRef.current[key] = true;
            const label = d === 0 ? "⚠️ AUJOURD'HUI" : `⏰ Dans ${d} jour${d > 1 ? "s" : ""}`;
            const type = item.target !== undefined ? "objectif" : "tâche";
            addToast({ title: `${label} — ${type} : ${item.title}`, icon: d === 0 ? "🔴" : d === 1 ? "🟠" : "🟡", badges: [label], target: item.target !== undefined ? "objectives" : "todo" });
          }
        });
      });
    };
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, [loggedIn, tasks, objectives, currentUserId, addToast]);

  // Keep a ref to users for login (closure issue)
  const usersRef = useRef(users);
  useEffect(() => { usersRef.current = users; }, [users]);

  // ── Synchronisation Firebase Auth → état applicatif — 5 états explicites ──
  // usersFirestoreReady provient directement de useSyncState (3e élément du tuple) :
  // il passe à true dès que le premier callback onSnapshot Firestore s'exécute,
  // sans compter les renders ni dépendre du StrictMode ou du fallback window.storage.
  useEffect(() => {
    if (!USE_FIREBASE_AUTH) return;
    // État 1 : Firebase Auth encore en cours d'initialisation
    if (authLoading) return;

    // Pas de session Firebase
    if (!firebaseUser) {
      setLoggedIn(false);
      setCurrentUserId(null);
      return;
    }

    // État 4 : authentifié mais aucun Custom Claim appId
    if (fbAppId == null) {
      logoutUser().catch(() => {});
      setLoggedIn(false);
      setCurrentUserId(null);
      setLoginError("Compte non configuré. Contactez l'administrateur.");
      setLoginLoading(false);
      return;
    }

    // État 2 : Firebase prête, session restaurée, mais ep:users pas encore chargé depuis Firestore
    if (!usersFirestoreReady) return;

    // États 3 & 5 : Firebase + données métier disponibles → résoudre l'utilisateur
    const bizUser = users.find(u => String(u.id) === String(fbAppId));
    if (bizUser) {
      // État 3 : tout est prêt, correspondance trouvée
      setCurrentUserId(bizUser.id);
      CURRENT_USER_ID = bizUser.id;
      setLoggedIn(true);
      setLoginLoading(false);
      setLoginError("");
    } else {
      // État 5 : Firestore chargé mais aucun utilisateur métier correspondant à l'appId
      logoutUser().catch(() => {});
      setLoggedIn(false);
      setCurrentUserId(null);
      setLoginError("Compte non reconnu dans l'application. Contactez l'administrateur.");
      setLoginLoading(false);
    }
  }, [firebaseUser, fbAppId, authLoading, usersFirestoreReady, users]);

  const handleForgotPassword = async () => {
    if (USE_FIREBASE_AUTH) {
      if (!loginEmail || !loginEmail.includes("@")) {
        setLoginError("Saisissez votre adresse email ci-dessus puis cliquez sur Mot de passe oublié.");
        return;
      }
      try {
        await resetPassword(loginEmail, "https://espritpadelcom.netlify.app");
        setLoginForgotSent(true);
        setLoginForgot(false);
        setLoginError("");
      } catch (err) {
        if (err.code === "auth/user-not-found" || err.code === "auth/invalid-email") {
          setLoginForgotSent(true); // Ne pas révéler si l'email existe
        } else {
          setLoginError("Impossible d'envoyer l'email. Réessayez dans quelques instants.");
        }
      }
      return;
    }
    setLoginForgot(true);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginForgotSent(false);
    if (!loginEmail || !loginPassword) { setLoginError("Veuillez remplir tous les champs"); return; }
    if (!loginEmail.includes("@")) { setLoginError("Adresse email invalide"); return; }
    setLoginLoading(true);

    // ── Firebase Auth ────────────────────────────────────────────────────────
    if (USE_FIREBASE_AUTH) {
      try {
        await loginUser(loginEmail, loginPassword, rememberMe);
        // onAuthStateChanged → useEffect de synchronisation prend le relais
        // setLoggedIn/setCurrentUserId sont gérés par l'effect, pas ici
        try {
          if (rememberMe) {
            localStorage.setItem("ep_rememberEmail", loginEmail);
            localStorage.setItem("ep_remember", "true");
          } else {
            localStorage.removeItem("ep_rememberEmail");
            localStorage.removeItem("ep_remember");
          }
        } catch {}
      } catch (err) {
        let msg = "Email ou mot de passe incorrect";
        if (err.code === "auth/too-many-requests") msg = "Trop de tentatives. Réessayez dans quelques minutes.";
        else if (err.code === "auth/user-disabled") msg = "Ce compte est désactivé. Contactez l'administrateur.";
        else if (err.code === "auth/network-request-failed") msg = "Erreur réseau. Vérifiez votre connexion.";
        setLoginError(msg);
        setLoginLoading(false);
      }
      return;
    }

    // ── Ancien système (USE_FIREBASE_AUTH = false) ───────────────────────────
    const doLogin = (userList) => {
      const user = userList.find(u => u.email && u.email.toLowerCase() === loginEmail.toLowerCase().trim() && u.password === loginPassword);
      if (user) {
        setCurrentUserId(user.id);
        CURRENT_USER_ID = user.id;
        setLoggedIn(true);
        // FCM permission is NOT requested here - handled by user click on 🔔 button
        try {
          if (rememberMe) {
            localStorage.setItem("ep_loggedIn", "true");
            localStorage.setItem("ep_userId", String(user.id));
            localStorage.setItem("ep_rememberEmail", loginEmail);
            localStorage.setItem("ep_remember", "true");
          } else {
            localStorage.removeItem("ep_loggedIn");
            localStorage.removeItem("ep_userId");
            localStorage.removeItem("ep_rememberEmail");
            localStorage.removeItem("ep_remember");
          }
        } catch {}
        setLoginLoading(false);
        return true;
      }
      return false;
    };

    // Try 1: use current state
    if (doLogin(usersRef.current)) return;

    // Try 2: read directly from Firestore (init Firebase if needed)
    (async () => {
      let db = _fb_db;
      // If Firebase wasn't initialized at top level, try now
      if (!db) {
        try {
          const fbApp = initializeApp({
            apiKey: "AIzaSyDsl7R4EAHI-u6SdgyAqvO725GX8Hnoq5U",
            authDomain: "esprit-padel-communication.firebaseapp.com",
            projectId: "esprit-padel-communication",
            storageBucket: "esprit-padel-communication.firebasestorage.app",
            messagingSenderId: "407619706622",
            appId: "1:407619706622:web:c748b160827c34dee34faf"
          }, "login-fallback-" + Date.now());
          db = getFirestore(fbApp);
        } catch {
          // Maybe already initialized, try to get existing
          try {
            db = getFirestore(getApp());
          } catch {}
        }
      }
      if (db) {
        try {
          const snap = await fbGetDoc(fbDoc(db, "appdata", "ep:users"));
          if (snap.exists()) {
            const firestoreUsers = snap.data().value || [];
            if (doLogin(firestoreUsers)) return;
          }
        } catch (e) { console.error("Login Firestore error:", e); }
      }
      // Try 3: wait 4s for useSyncState to load, then retry
      await new Promise(r => setTimeout(r, 4000));
      if (doLogin(usersRef.current)) return;
      setLoginError("Email ou mot de passe incorrect");
      setLoginLoading(false);
    })();
  };

  const currentUser = currentUserId ? users.find(u => String(u.id) === String(currentUserId)) : null;
  const isAdmin = currentUser?.admin || false;
  const isDirector = currentUser?.role === "Directeur";
  const allowedClubIds = new Set((currentUser?.clubs || []).map(String));
  const scopedClubs = isAdmin ? clubs : clubs.filter(club => allowedClubIds.has(String(club.id)));
  const scopedUsers = isAdmin ? users : users.filter(user => (user.clubs || []).some(clubId => allowedClubIds.has(String(clubId))));
  const hasAllowedClub = item => {
    const ids = item?.clubs || item?.clubIds || (item?.clubId != null ? [item.clubId] : item?.club != null ? [item.club] : []);
    return (Array.isArray(ids) ? ids : [ids]).some(id => allowedClubIds.has(String(id)));
  };
  const scopeByClub = records => isAdmin ? records : (records || []).filter(hasAllowedClub);
  const scopedObjectives = scopeByClub(objectives);
  const scopedTasks = scopeByClub(tasks);
  const scopedRequests = scopeByClub(requests);
  const scopedMeetings = scopeByClub(meetings);
  const scopedProjects = scopeByClub(projects);
  const scopedHashtags = scopeByClub(hashtags);
  const scopedBriefs = scopeByClub(briefs);
  const scopedSurveys = scopeByClub(surveys);
  const scopedTournaments = scopeByClub(tournaments);

  // ===== LOGIN PAGE =====
  // ===== LOGIN PAGE =====
  const [guestMode, setGuestMode] = useState(false);
  const [guestForm, setGuestForm] = useState({ club: "", members: [], title: "", description: "", deadline: "", forWho: "", email: "", phone: "" });
  const [guestClubs, setGuestClubs] = useState([]);
  const [guestUsers, setGuestUsers] = useState([]);
  const [guestSent, setGuestSent] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  // Load clubs and users for guest form
  useEffect(() => {
    if (!guestMode || guestClubs.length > 0) return;
    (async () => {
      try {
        if (!_fb_db) return;
        const clubSnap = await fbGetDoc(fbDoc(_fb_db, "appdata", "ep:clubs"));
        if (clubSnap.exists()) setGuestClubs(clubSnap.data().value || []);
        const userSnap = await fbGetDoc(fbDoc(_fb_db, "appdata", "ep:users"));
        if (userSnap.exists()) setGuestUsers(userSnap.data().value || []);
      } catch {}
    })();
  }, [guestMode]);

  const submitGuestTask = async () => {
    if (!guestForm.title || guestForm.members.length === 0) return;
    setGuestLoading(true);
    try {
      // Read current tasks
      const taskSnap = await fbGetDoc(fbDoc(_fb_db, "appdata", "ep:tasks"));
      const currentTasks = taskSnap.exists() ? (taskSnap.data().value || []) : [];
      
      const fullDetails = `📋 DEMANDE EXTERNE

📝 Intitulé : ${guestForm.title}

📄 Description :
${guestForm.description || "(Aucune description)"}

📅 Date souhaitée : ${guestForm.deadline || "Non précisée"}

👤 De la part de : ${guestForm.forWho || "Non précisé"}
📧 Email : ${guestForm.email || "Non précisé"}
📞 Téléphone : ${guestForm.phone || "Non précisé"}`;

      const newTask = {
        id: uid(), 
        title: guestForm.title, 
        description: guestForm.description, 
        clubs: guestForm.club ? [guestForm.club] : [],
        deadline: guestForm.deadline, 
        urgency: "Normal", 
        assignee: guestForm.forWho, 
        assignedTo: guestForm.members,
        status: "À faire", 
        recurrence: "Aucune", 
        subtasks: [],
        notes: [
          { id: uid(), text: fullDetails, type: "info" }
        ],
        owner: "guest", 
        guestEmail: guestForm.email, 
        guestPhone: guestForm.phone, 
        guestName: guestForm.forWho,
        createdAt: new Date().toISOString(),
        source: "external_request",
        history: [{ id: uid(), at: new Date().toISOString(), userId: "guest", text: "Demande extérieure reçue et transformée automatiquement en tâche" }],
        comments: [],
        timeEntries: []
      };
      await setDoc(fbDoc(_fb_db, "appdata", "ep:tasks"), { value: [newTask, ...currentTasks], updatedAt: Date.now() });

      // Keep a dedicated request record for the Demandes workspace.
      const requestSnap = await fbGetDoc(fbDoc(_fb_db, "appdata", "ep:requests"));
      const currentRequests = requestSnap.exists() ? (requestSnap.data().value || []) : [];
      const externalRequest = {
        id: uid(),
        subject: guestForm.title,
        description: guestForm.description || "",
        firstName: guestForm.forWho || "Externe",
        lastName: "",
        email: guestForm.email || "",
        phone: guestForm.phone || "",
        club: guestForm.club,
        clubs: guestForm.club ? [guestForm.club] : [],
        assigneeId: guestForm.members[0],
        assignedTo: guestForm.members,
        deadline: guestForm.deadline || "",
        status: "Nouvelle",
        taskId: newTask.id,
        createdAt: new Date().toISOString()
      };
      await setDoc(fbDoc(_fb_db, "appdata", "ep:requests"), { value: [externalRequest, ...currentRequests], updatedAt: Date.now() });

      // Notify each assigned member with more details
      for (const memberId of guestForm.members) {
        const notifKey = `ep:notifs_${memberId}`;
        const notifSnap = await fbGetDoc(fbDoc(_fb_db, "appdata", notifKey));
        const currentNotifs = notifSnap.exists() ? (notifSnap.data().value || []) : [];
        const notifTitle = `📋 ${guestForm.forWho || "Externe"} : ${guestForm.title}${guestForm.deadline ? ` (pour le ${guestForm.deadline})` : ""}`;
        const notif = { 
          id: uid(), 
          title: notifTitle, 
          description: guestForm.description,
          type: "TASK_ASSIGNED", 
          icon: "📋", 
          badges: ["Demande externe", guestForm.forWho || ""], 
          target: "todo", 
          time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), 
          date: new Date().toLocaleDateString("fr-FR"), 
          timestamp: Date.now() 
        };
        await setDoc(fbDoc(_fb_db, "appdata", notifKey), { value: [notif, ...currentNotifs].slice(0, 50), updatedAt: Date.now() });
      }

      setGuestSent(true);
    } catch (e) { console.error("Guest task error:", e); }
    setGuestLoading(false);
  };

  // ── Écran de chargement Firebase (évite le flash login → app) ──────────────
  // Couvre État 1 (authLoading) ET État 2 (session active, ep:users pas encore chargé)
  if (USE_FIREBASE_AUTH && (authLoading || (firebaseUser != null && !usersFirestoreReady))) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#2D2D30", fontFamily: "'Montserrat', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#FEB601", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Connexion en cours…</div>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    // GUEST FORM
    if (guestMode) {
      if (guestSent) return (
        <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat', sans-serif", background: "#2D2D30" }}>
          <div style={{ width: "min(420px, 90vw)", textAlign: "center", animation: "fadeUp .5s ease" }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap'); @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <div style={{ background: "#fff", borderRadius: 16, padding: "40px 32px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#10B981", marginBottom: 8 }}>Demande envoyée !</h2>
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Votre demande a été transmise à l'équipe. Vous serez contacté rapidement.</p>
              <button onClick={() => { setGuestMode(false); setGuestSent(false); setGuestForm({ club: "", members: [], title: "", description: "", deadline: "", forWho: "", email: "", phone: "" }); }} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#0F56B8", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Retour</button>
            </div>
          </div>
        </div>
      );

      const clubUsers = guestForm.club ? guestUsers.filter(u => (u.clubs || []).some(uc => String(uc) === String(guestForm.club))) : guestUsers;
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat', sans-serif", background: "#2D2D30", padding: "20px 0" }}>
          <style>{`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap'); * { box-sizing: border-box; } @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          <div style={{ width: "min(480px, 90vw)", animation: "fadeUp .5s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#FEB601", letterSpacing: 2, textTransform: "uppercase" }}>Communication</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 16, padding: "28px 28px", boxShadow: "0 4px 24px rgba(0,0,0,.06)" }}>
              <button onClick={() => setGuestMode(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6B7280", marginBottom: 12, fontFamily: "inherit" }}>← Retour connexion</button>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "#2D2D30" }}>📋 Demande de tâche</h2>
              <p style={{ margin: "0 0 20px", fontSize: 12, color: "#6B7280" }}>Envoyez une demande à l'équipe communication</p>

              {/* Club selection */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#2D2D30", marginBottom: 6 }}>Pour quel club ?</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {guestClubs.map(c => (<button key={c.id} onClick={() => setGuestForm(p => ({ ...p, club: p.club === c.id ? "" : c.id, members: [] }))} style={{ padding: "8px 16px", borderRadius: 10, border: `2px solid ${guestForm.club === c.id ? (c.color || "#0F56B8") : "#E2E8F0"}`, background: guestForm.club === c.id ? (c.color || "#0F56B8") + "15" : "#F4F2EF", color: guestForm.club === c.id ? (c.color || "#0F56B8") : "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{c.name}{guestForm.club === c.id && " ✓"}</button>))}
                </div>
              </div>

              {/* Single recipient selection, filtered by the selected club */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#2D2D30", marginBottom: 6 }}>Choisir le destinataire</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {clubUsers.map(u => (<button key={u.id} onClick={() => setGuestForm(p => ({ ...p, members: p.members.includes(u.id) ? [] : [u.id] }))} style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${guestForm.members.includes(u.id) ? "#0F56B8" : "#E2E8F0"}`, background: guestForm.members.includes(u.id) ? "#0F56B815" : "transparent", color: guestForm.members.includes(u.id) ? "#0F56B8" : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{u.firstName} {u.lastName}{guestForm.members.includes(u.id) && " ✓"}</button>))}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#2D2D30", marginBottom: 4 }}>Intitulé de la demande *</label>
                <input value={guestForm.title} onChange={e => setGuestForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Affiche pour tournoi samedi" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "#F4F2EF" }} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#2D2D30", marginBottom: 4 }}>Description</label>
                <textarea value={guestForm.description} onChange={e => setGuestForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Détaillez votre demande..." style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "vertical", background: "#F4F2EF" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#2D2D30", marginBottom: 4 }}>Date limite</label><input type="date" value={guestForm.deadline} onChange={e => setGuestForm(p => ({ ...p, deadline: e.target.value }))} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 13, fontFamily: "inherit", background: "#F4F2EF", boxSizing: "border-box" }} /></div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#2D2D30", marginBottom: 4 }}>De la part de</label><input value={guestForm.forWho} onChange={e => setGuestForm(p => ({ ...p, forWho: e.target.value }))} placeholder="Votre nom" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 13, fontFamily: "inherit", background: "#F4F2EF", boxSizing: "border-box" }} /></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#2D2D30", marginBottom: 4 }}>Email</label><input type="email" value={guestForm.email} onChange={e => setGuestForm(p => ({ ...p, email: e.target.value }))} placeholder="email@exemple.com" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 13, fontFamily: "inherit", background: "#F4F2EF", boxSizing: "border-box" }} /></div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#2D2D30", marginBottom: 4 }}>Téléphone</label><input type="tel" value={guestForm.phone} onChange={e => setGuestForm(p => ({ ...p, phone: e.target.value }))} placeholder="06 12 34 56 78" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 13, fontFamily: "inherit", background: "#F4F2EF", boxSizing: "border-box" }} /></div>
              </div>

              <button onClick={submitGuestTask} disabled={guestLoading || !guestForm.title || guestForm.members.length === 0} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: (!guestForm.title || guestForm.members.length === 0) ? "#CBD5E1" : guestLoading ? "#94A3B8" : "#10B981", color: "#fff", fontSize: 14, fontWeight: 700, cursor: (!guestForm.title || guestForm.members.length === 0) ? "default" : "pointer", fontFamily: "inherit" }}>
                {guestLoading ? "Envoi en cours..." : "📤 Envoyer la demande"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat', sans-serif", background: "#2D2D30" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap');
          * { box-sizing: border-box; }
          @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        `}</style>

        <div style={{ width: "min(420px, 90vw)", padding: "0 12px", animation: "fadeUp .5s ease" }}>
          {/* Logo + brand */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-block", marginBottom: 4 }}>
              <img src={LOGO_URI} alt="Esprit Padel" style={{ height: 40, objectFit: "contain", display: "block" }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#FEB601", letterSpacing: 2, textTransform: "uppercase", marginBottom: 0 }}>Communication</div>
          </div>

          {/* Card */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "36px 32px", boxShadow: "0 4px 24px rgba(0,0,0,.06)" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "#2D2D30" }}>Connexion</h2>
              <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Accédez à votre espace de travail</p>
            </div>

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#2D2D30", marginBottom: 6 }}>Email professionnel</label>
                <input
                  type="email" value={loginEmail}
                  onChange={e => { setLoginEmail(e.target.value); setLoginError(""); }}
                  placeholder="prenom@espritpadel.com"
                  autoComplete="email"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${loginError ? "#EF4444" : "#E2E8F0"}`, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", transition: "border .2s", background: "#F4F2EF" }}
                  onFocus={e => e.target.style.borderColor = "#0F56B8"}
                  onBlur={e => e.target.style.borderColor = loginError ? "#EF4444" : "#E2E8F0"}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#2D2D30", marginBottom: 6 }}>Mot de passe</label>
                <input
                  type="password" value={loginPassword}
                  onChange={e => { setLoginPassword(e.target.value); setLoginError(""); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${loginError ? "#EF4444" : "#E2E8F0"}`, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", transition: "border .2s", background: "#F4F2EF" }}
                  onFocus={e => e.target.style.borderColor = "#0F56B8"}
                  onBlur={e => e.target.style.borderColor = loginError ? "#EF4444" : "#E2E8F0"}
                />
              </div>

              {loginError && (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA", marginBottom: 14, fontSize: 12, color: "#EF4444", fontWeight: 500 }}>
                  {loginError}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ accentColor: "#0F56B8" }} />
                  <span style={{ fontSize: 11, color: "#6B7280" }}>Se souvenir de moi</span>
                </label>
                <span onClick={handleForgotPassword} style={{ fontSize: 11, color: "#0F56B8", cursor: "pointer", fontWeight: 600 }}>Mot de passe oublié ?</span>
              </div>

              {loginForgot && !USE_FIREBASE_AUTH && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "#0F56B810", border: "1px solid #0F56B830", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>📩</span>
                  <div><div style={{ fontSize: 12, fontWeight: 600, color: "#0F56B8" }}>Contactez votre administrateur</div><div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>melissa@espritpadel.com</div></div>
                  <button onClick={() => setLoginForgot(false)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: 12 }}>✕</button>
                </div>
              )}
              {loginForgotSent && USE_FIREBASE_AUTH && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "#10B98110", border: "1px solid #10B98130", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>✅</span>
                  <div><div style={{ fontSize: 12, fontWeight: 600, color: "#10B981" }}>Email envoyé</div><div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>Vérifiez votre boîte mail pour réinitialiser votre mot de passe.</div></div>
                  <button onClick={() => setLoginForgotSent(false)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: 12 }}>✕</button>
                </div>
              )}

              <button type="submit" disabled={loginLoading}
                style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: loginLoading ? "#94A3B8" : "#0F56B8", color: "#fff", fontSize: 14, fontWeight: 700, cursor: loginLoading ? "default" : "pointer", fontFamily: "inherit", transition: "all .2s", animation: loginLoading ? "pulse 1s infinite" : "none" }}
              >
                {loginLoading ? "Connexion en cours..." : "Se connecter"}
              </button>
            </form>
          </div>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button onClick={() => setGuestMode(true)} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "2px solid #FEB601", background: "transparent", color: "#FEB601", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📋 Envoyer une demande de tâche</button>
          </div>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Esprit Padel Communication © 2026</div>
          </div>
        </div>
      </div>
    );
  }

  const theme = currentUser?.theme || DEFAULT_THEME;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Montserrat', sans-serif", background: theme.background, color: theme.textMain, overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html { -webkit-text-size-adjust: 100%; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
        @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
        
        /* MOBILE RESPONSIVE */
        @media (max-width: 767px) {
          .responsive-grid-2 { grid-template-columns: 1fr !important; }
          .responsive-grid-3 { grid-template-columns: 1fr !important; }
          .responsive-grid-4 { grid-template-columns: 1fr 1fr !important; }
          .responsive-hide { display: none !important; }
          button, a, input, select, textarea { font-size: 16px !important; min-height: 44px; }
          input[type="date"], input[type="time"] { min-height: 44px; }
          .kanban-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .responsive-grid-3 { grid-template-columns: 1fr 1fr !important; }
          .responsive-grid-4 { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Sidebar */}
      {isMobile && sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 998 }} />}
      <div style={{ width: sidebarOpen ? 240 : (isMobile ? 0 : 60), background: theme.sidebar, borderRight: `1px solid ${theme.textSecondary}20`, display: "flex", flexDirection: "column", transition: "all .25s ease", overflow: "hidden", flexShrink: 0, ...(isMobile ? { position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 999, transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)", width: 260 } : {}) }}>
        <div style={{ padding: sidebarOpen ? "20px 16px" : "20px 10px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${theme.textSecondary}20` }}>
          <button onClick={() => setSidebarOpen(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: theme.sidebarText, flexShrink: 0 }}>{sidebarOpen ? "◀" : "▶"}</button>
          {sidebarOpen && <img src={LOGO_URI} alt="Esprit Padel" style={{ height: 28, objectFit: "contain" }} />}
        </div>
        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {NAV_ITEMS.filter(item => !item.adminOnly || isAdmin).map(item => (
            <button key={item.id} onClick={() => { setPage(item.id); if (isMobile) setSidebarOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: sidebarOpen ? "10px 16px" : "10px", background: page === item.id ? theme.primary + "08" : "transparent", border: "none", borderLeft: page === item.id ? `3px solid ${theme.primary}` : "3px solid transparent", color: page === item.id ? theme.primary : theme.sidebarText, cursor: "pointer", fontSize: 13, fontWeight: page === item.id ? 600 : 400, fontFamily: "inherit", textAlign: "left", transition: "all .15s", justifyContent: sidebarOpen ? "flex-start" : "center" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span style={{ whiteSpace: "nowrap", flex: 1 }}>{item.label}</span>}
              {item.id === "metricool-approvals" && Number(metricoolApprovals?.pendingCount || 0) > 0 && <span style={{ minWidth: 19, height: 19, padding: "0 5px", borderRadius: 10, background: "#EF4444", color: "#fff", fontSize: 9, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{metricoolApprovals.pendingCount}</span>}
            </button>
          ))}
          {/* Custom pages in sidebar */}
          {customPages.filter(cp => cp.published && (cp.visibleTo === "all" || (cp.visibleTo || []).includes(currentUserId) || isAdmin)).map(cp => (
            <button key={`cp_${cp.id}`} onClick={() => { setPage(`custom_${cp.id}`); if (isMobile) setSidebarOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: sidebarOpen ? "10px 16px" : "10px", background: page === `custom_${cp.id}` ? theme.primary + "08" : "transparent", border: "none", borderLeft: page === `custom_${cp.id}` ? `3px solid ${theme.primary}` : "3px solid transparent", color: page === `custom_${cp.id}` ? theme.primary : theme.sidebarText, cursor: "pointer", fontSize: 13, fontWeight: page === `custom_${cp.id}` ? 600 : 400, fontFamily: "inherit", textAlign: "left", transition: "all .15s", justifyContent: sidebarOpen ? "flex-start" : "center" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{cp.icon || "📄"}</span>
              {sidebarOpen && <span style={{ whiteSpace: "nowrap", flex: 1 }}>{cp.title}</span>}
            </button>
          ))}
        </nav>
        <div style={{ padding: sidebarOpen ? "10px 16px" : "10px 6px", borderTop: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 6 }} onClick={() => setPage("profile")}>
            <Avatar name={`${currentUser.firstName} ${currentUser.lastName}`} size={32} color="#6366F1" />
            {sidebarOpen && <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, color: "#2D2D30" }}>{currentUser.firstName} {currentUser.lastName}</div><div style={{ fontSize: 10, color: "#94A3B8" }}>{currentUser.role}</div></div>}
          </div>
          {sidebarOpen && <button onClick={() => {
            setLoginPassword("");
            try { localStorage.removeItem("ep_loggedIn"); localStorage.removeItem("ep_userId"); } catch {}
            if (USE_FIREBASE_AUTH) {
              logoutUser().catch(() => {}); // onAuthStateChanged → useEffect → setLoggedIn(false)
            } else {
              setLoggedIn(false);
            }
          }} style={{ width: "100%", padding: "5px 0", borderRadius: 6, border: "1px solid #FEE2E2", background: "#FEF2F2", color: "#EF4444", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Déconnexion</button>}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div style={{ padding: isMobile ? "8px 12px" : "8px 28px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: isMobile ? 4 : 6, borderBottom: `1px solid ${theme.textSecondary}20`, background: theme.cardBg, flexShrink: 0 }}>
          {/* Mobile hamburger */}
          {isMobile && <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: theme.textMain, marginRight: 4 }}>☰</button>}
          {/* Search */}
          <div style={{ position: "relative", marginRight: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <input ref={searchRef} value={globalSearch} onChange={e => { setGlobalSearch(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder="Rechercher... (Ctrl+K)" style={{ width: isMobile ? 120 : isTablet ? 160 : 220, padding: "6px 12px 6px 30px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 11, fontFamily: "inherit", outline: "none", background: "#F4F2EF" }} />
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#6B7280" }}>🔍</span>
              {searchOpen && globalSearch && searchResults.length > 0 && (
                <div style={{ position: "absolute", top: 34, left: 0, width: "min(320px, 80vw)", background: "#fff", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,.15)", border: "1px solid #E2E8F0", zIndex: 999, maxHeight: 300, overflowY: "auto" }}>
                  {searchResults.map((r, i) => (<div key={i} onClick={() => { setPage(r.target); setSearchOpen(false); setGlobalSearch(""); }} style={{ padding: "8px 14px", cursor: "pointer", display: "flex", gap: 8, alignItems: "center", borderBottom: "1px solid #F1F5F9" }} onMouseEnter={e => e.currentTarget.style.background = "#F4F2EF"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><span style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", width: 80 }}>{r.type}</span><span style={{ fontSize: 12, color: "#2D2D30", fontWeight: 600 }}>{r.title}</span></div>))}
                </div>
              )}
              {searchOpen && globalSearch && searchResults.length === 0 && (<div style={{ position: "absolute", top: 34, left: 0, width: 240, background: "#fff", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.1)", border: "1px solid #E2E8F0", zIndex: 999, padding: "12px 16px", fontSize: 12, color: "#6B7280" }}>Aucun résultat</div>)}
            </div>
            {/* Help */}
            <button onClick={() => setShowHelp(p => !p)} title="Aide (H)" style={{ background: "none", border: "1.5px solid #E2E8F0", borderRadius: 8, cursor: "pointer", padding: "4px 8px", fontSize: 11, color: "#6B7280", fontWeight: 700, fontFamily: "inherit" }}>?</button>
          </div>
          {/* Chronometre */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setChronoOpen(p => !p)} style={{ background: chronoRunning ? "#10B98110" : "none", border: chronoRunning ? "1.5px solid #10B98140" : "1.5px solid transparent", borderRadius: 8, cursor: "pointer", padding: "4px 10px", display: "flex", alignItems: "center", gap: 6, transition: "all .15s" }}>
              <span style={{ fontSize: 14 }}>⏱️</span>
              {chronoRunning && <span style={{ fontSize: 12, fontWeight: 700, color: "#10B981", fontFamily: "JetBrains Mono, monospace" }}>{formatChrono(chronoElapsed)}</span>}
              {!chronoRunning && chronoElapsed > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B", fontFamily: "JetBrains Mono, monospace" }}>{formatChrono(chronoElapsed)}</span>}
            </button>
            {chronoOpen && (
              <div style={{ position: "absolute", top: 40, left: 0, background: "#fff", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,.15)", border: "1px solid #E2E8F0", padding: 16, zIndex: 999, width: "min(220px, 80vw)" }}>
                <div style={{ textAlign: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", marginBottom: 4 }}>Temps de travail</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: chronoRunning ? "#10B981" : chronoElapsed > 0 ? "#F59E0B" : "#2D2D30", fontFamily: "JetBrains Mono, monospace" }}>{formatChrono(chronoElapsed)}</div>
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                  {!chronoRunning ? (
                    <button onClick={startChrono} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "#10B981", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>▶ {chronoElapsed > 0 ? "Reprendre" : "Démarrer"}</button>
                  ) : (
                    <button onClick={stopChrono} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "#F59E0B", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>⏸ Pause</button>
                  )}
                  {chronoElapsed > 0 && <button onClick={resetChrono} style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>↺ Reset</button>}
                </div>
                {chronoElapsed > 0 && (
                  <div style={{ marginTop: 10, textAlign: "center", fontSize: 10, color: "#94A3B8" }}>
                    {chronoElapsed >= 3600 ? `${Math.floor(chronoElapsed / 3600)}h ${Math.floor((chronoElapsed % 3600) / 60)}min` : `${Math.floor(chronoElapsed / 60)} minutes`} de travail
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mail */}
          <button onClick={() => { const email = prompt("Envoyer un email à :", ""); if (email) window.open(`mailto:${email}`); }} title="Envoyer un email" style={{ background: "none", border: "1.5px solid transparent", borderRadius: 8, cursor: "pointer", padding: "3px 8px", display: "flex", alignItems: "center", gap: 4, transition: "all .15s" }} onMouseEnter={e => { e.currentTarget.style.background = "#0F56B810"; e.currentTarget.style.border = "1.5px solid #0F56B840"; }} onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.border = "1.5px solid transparent"; }}>
            <span style={{ fontSize: 14 }}>📧</span>
            {!isMobile && <span style={{ fontSize: 10, fontWeight: 600, color: "#0F56B8" }}>Mail</span>}
          </button>
          {/* Metricool */}
          <button onClick={() => window.open("https://app.metricool.com", "_blank")} title="Ouvrir Metricool" style={{ background: "none", border: "1.5px solid transparent", borderRadius: 8, cursor: "pointer", padding: "3px 8px", display: "flex", alignItems: "center", gap: 5, transition: "all .15s" }} onMouseEnter={e => { e.currentTarget.style.background = "#E4405F10"; e.currentTarget.style.border = "1.5px solid #E4405F40"; }} onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.border = "1.5px solid transparent"; }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#E4405F", fontFamily: "inherit" }}>M</span>
            {!isMobile && <span style={{ fontSize: 10, fontWeight: 600, color: "#E4405F" }}>Metricool</span>}
            {!isMobile && <span style={{ fontSize: 8, color: "#94A3B8" }}>↗</span>}
          </button>
          {/* Canva */}
          <button onClick={() => window.open("https://www.canva.com", "_blank")} title="Ouvrir Canva" style={{ background: "none", border: "1.5px solid transparent", borderRadius: 8, cursor: "pointer", padding: "3px 8px", display: "flex", alignItems: "center", gap: 5, transition: "all .15s" }} onMouseEnter={e => { e.currentTarget.style.background = "#00C4CC10"; e.currentTarget.style.border = "1.5px solid #00C4CC40"; }} onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.border = "1.5px solid transparent"; }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#00C4CC", fontFamily: "inherit" }}>C</span>
            {!isMobile && <span style={{ fontSize: 10, fontWeight: 600, color: "#00C4CC" }}>Canva</span>}
            {!isMobile && <span style={{ fontSize: 8, color: "#94A3B8" }}>↗</span>}
          </button>
          {/* Chat */}
          <button onClick={() => setChatOpen(p => !p)} style={{ background: chatOpen ? "#25D36615" : "none", border: chatOpen ? "1.5px solid #25D366" : "1.5px solid transparent", borderRadius: 8, cursor: "pointer", fontSize: 20, padding: "3px 8px", position: "relative", transition: "all .15s" }} title="WhatsApp">
            💬
          </button>
          {fcmStatus === "idle" && <button onClick={requestPushPermission} title="Activer les notifications push" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, position: "relative", animation: "pulse 2s infinite" }}>🔔<span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: "#EF4444" }} /></button>}
          <NotificationBell notifications={notifications} onClear={() => setNotifications([])} onNavigate={(target) => { if (target === "chat") { setChatOpen(true); } else { setPage(target); } }} onDismissOne={(id) => setNotifications(p => p.filter(n => String(n.id) !== String(id)))} />
        </div>
        <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} users={scopedUsers} isUserOnline={isUserOnline} getLastSeen={getLastSeen} currentUserId={currentUserId} />
        <div style={{ flex: 1, overflow: "auto", padding: isMobile ? 12 : isTablet ? 18 : 28 }}>
          {page === "dashboard" && <Dashboard clubs={scopedClubs} objectives={scopedObjectives} tasks={scopedTasks} setTasks={setTasks} meetings={scopedMeetings} slots={slots} publications={publications} navigateTo={setPage} calendarEvents={calendarEvents} currentUser={currentUser} currentUserId={currentUserId} isAdmin={isAdmin} isDirector={isDirector} users={scopedUsers} />}
          {page === "objectives" && <ObjectivesPage clubs={scopedClubs} objectives={scopedObjectives} setObjectives={setObjectives} currentUserId={currentUserId} isAdmin={isAdmin} isDirector={isDirector} currentUser={currentUser} users={scopedUsers} addToast={addToast} reportingData={reportingData} />}
          {page === "todo" && <TaskPlanningWorkspace clubs={scopedClubs} users={scopedUsers} tasks={scopedTasks} setTasks={setTasks} requests={scopedRequests} setRequests={setRequests} meetings={scopedMeetings} setMeetings={setMeetings} slots={slots} setSlots={setSlots} personalPlans={personalPlans} setPersonalPlans={setPersonalPlans} currentUserId={currentUserId} currentUser={currentUser} isAdmin={isAdmin} isDirector={isDirector} addToast={addToast} renderMeetings={() => <MeetingsTab clubs={scopedClubs} meetings={scopedMeetings} setMeetings={setMeetings} slots={slots} setSlots={setSlots} users={scopedUsers} addToast={addToast} currentUserId={currentUserId} isAdmin={isAdmin} />} />}
          {page === "projects" && <ProjectsPage clubs={scopedClubs} users={scopedUsers} projects={scopedProjects} setProjects={setProjects} tasks={scopedTasks} setTasks={setTasks} currentUserId={currentUserId} isAdmin={isAdmin} addToast={addToast} notifyUser={notifyUser} />}
          {page === "reporting" && <ReportingPage clubs={clubs} reportingData={reportingData} setReportingData={setReportingData} currentUserId={currentUserId} isAdmin={isAdmin} currentUser={currentUser} />}
          {page === "metricool-approvals" && isAdmin && <MetricoolApprovalsPage approvals={metricoolApprovals} />}
          {page === "editorial" && <EditorialPage clubs={clubs} publications={publications} setPublications={setPublications} />}
          {page === "calendar" && <CalendarPage meetings={scopedMeetings} setMeetings={setMeetings} tasks={scopedTasks} setTasks={setTasks} calendarEvents={calendarEvents} setCalendarEvents={setCalendarEvents} currentUserId={currentUserId} isAdmin={isAdmin} campagnes={campagnes} tournaments={scopedTournaments} />}
          {(page === "drive" || page === "documents") && <DrivePage isMobile={isMobile} clubs={scopedClubs} isAdmin={isAdmin} />}
          {page === "tournaments" && <TournamentsPage clubs={clubs} tournaments={tournaments} setTournaments={setTournaments} users={users} currentUserId={currentUserId} currentUser={currentUser} isAdmin={isAdmin} />}
          {page === "notes" && <NotesPage notes={userNotes} setNotes={setUserNotes} users={users} currentUserId={currentUserId} />}
          {page === "elearning" && <ElearningPage elearning={elearningData} setElearning={setElearningData} users={users} currentUserId={currentUserId} isAdmin={isAdmin} notifyUser={notifyUser} />}
          {page === "hashtags" && <HashtagsPage hashtags={scopedHashtags} setHashtags={setHashtags} clubs={scopedClubs} currentUserId={currentUserId} isAdmin={isAdmin} currentUser={currentUser} />}
          {page === "templates" && <TemplatesPage templates={templates} setTemplates={setTemplates} currentUserId={currentUserId} isAdmin={isAdmin} templateCategories={templateCategories} setTemplateCategories={setTemplateCategories} isMobile={isMobile} isTablet={isTablet} briefs={scopedBriefs} setBriefs={setBriefs} clubs={scopedClubs} users={scopedUsers} />}
          {page === "veille" && <VeillePage veille={veille} setVeille={setVeille} clubs={clubs} currentUserId={currentUserId} isAdmin={isAdmin} notifyUser={notifyUser} users={users} />}


          {page === "campaigns" && <CampagnesPage campagnes={campagnes} setCampagnes={setCampagnes} clubs={clubs} users={users} isAdmin={isAdmin} isDirector={isDirector} currentUser={currentUser} currentUserId={currentUserId} addToast={addToast} />}
          {page === "surveys" && <SurveysPage surveys={scopedSurveys} setSurveys={setSurveys} surveyResponses={surveyResponses} setSurveyResponses={setSurveyResponses} clubs={scopedClubs} users={scopedUsers} isAdmin={isAdmin} isDirector={isDirector} currentUser={currentUser} currentUserId={currentUserId} addToast={addToast} />}
          {page === "pagebuilder" && isAdmin && <PageBuilder customPages={customPages} setCustomPages={setCustomPages} users={users} addToast={addToast} />}
          {customPages.filter(cp => cp.published).map(cp => page === `custom_${cp.id}` && <CustomPageView key={cp.id} page={cp} currentUserId={currentUserId} isAdmin={isAdmin} />)}
          {page === "directory" && <DirectoryPage clubs={scopedClubs} users={scopedUsers} />}
          {page === "profile" && <ProfilePage users={users} setUsers={setUsers} currentUserId={currentUserId} isAdmin={isAdmin} clubs={clubs} setClubs={setClubs} currentUser={currentUser} onlineUsers={onlineUsers} activityLog={activityLog} customPages={customPages} setCustomPages={setCustomPages} addToast={addToast} competences={competences} setCompetences={setCompetences} />}
          {page === "activity" && isAdmin && (<div>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>📜 Historique d'activité</h2>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>{activityLog.length} actions enregistrées</div>
            {activityLog.length === 0 ? <Card style={{ padding: 20, textAlign: "center" }}><span style={{ fontSize: 12, color: "#6B7280" }}>Aucune activité enregistrée</span></Card> : activityLog.map(a => { const u = users.find(x => String(x.id) === String(a.userId)); return (<Card key={a.id} style={{ padding: 10, marginBottom: 6 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={u ? `${u.firstName} ${u.lastName}` : "?"} size={24} color={["#6366F1","#EC4899","#10B981","#FB8500"][(a.userId || 0) % 4]} /><div style={{ flex: 1 }}><span style={{ fontSize: 12, fontWeight: 600, color: "#2D2D30" }}>{u?.firstName || "?"}</span><span style={{ fontSize: 11, color: "#6B7280" }}> — {a.action}</span></div><span style={{ fontSize: 10, color: "#CBD5E1" }}>{new Date(a.time).toLocaleString("fr-FR")}</span></div></Card>); })}
          </div>)}
        </div>
      </div>
      {/* Help modal */}
      {showHelp && (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowHelp(false)}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, width: "min(460px, 90vw)", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#2D2D30" }}>❓ Aide & raccourcis</h2><button onClick={() => setShowHelp(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6B7280" }}>✕</button></div>
          <div style={{ marginBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#0F56B8", marginBottom: 8 }}>⌨️ Raccourcis clavier</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><tbody>
              {[["Ctrl+K", "Recherche globale"], ["D", "Dashboard"], ["N", "Tâches"], ["C", "Calendrier"], ["P", "Projets"], ["O", "Objectifs"], ["R", "Reporting"], ["T", "Tournois"], ["H ou ?", "Aide"], ["Échap", "Fermer"]].map(([k, d]) => (
                <tr key={k} style={{ borderBottom: "1px solid #F1F5F9" }}><td style={{ padding: "6px 0" }}><span style={{ padding: "2px 8px", borderRadius: 4, background: "#F4F2EF", fontFamily: "JetBrains Mono, monospace", fontSize: 11, fontWeight: 600 }}>{k}</span></td><td style={{ padding: "6px 0", color: "#6B7280" }}>{d}</td></tr>
              ))}
            </tbody></table>
          </div>
          <div style={{ marginBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#0F56B8", marginBottom: 8 }}>📱 Pages disponibles</div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.8 }}>Dashboard · Objectifs · Tâches & Réunions · Projets · Reporting · Calendrier · Documents · Photos · Tournois · E-Learning · Templates · Briefs créatifs · Veille · Campagnes · Sondages · Annuaire · Profil{isAdmin ? " · Paramètres (admin)" : ""}</div>
          </div>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: "#0F56B8", marginBottom: 8 }}>💡 Astuces</div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.8 }}>• Personnalisez votre dashboard avec le bouton ⚙ Personnaliser<br/>• Changez les couleurs de l'interface dans Profil → 🎨 Couleurs<br/>• Le chronomètre ⏱️ dans la barre du haut track votre temps de travail<br/>• Exportez vos rapports, évaluations et notes en PDF/HTML<br/>• Utilisez les templates pour créer du contenu rapidement</div>
          </div>
        </div>
      </div>)}
    </div>
  );
}
