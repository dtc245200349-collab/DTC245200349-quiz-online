<?php
// No PMA_USER/PMA_PASSWORD: require interactive cookie authentication.
$cfg['Servers'][1]['AllowNoPassword'] = false;
$cfg['Servers'][1]['AllowRoot'] = false;
$cfg['LoginCookieValidity'] = 1800;
$cfg['LoginCookieStore'] = 0;
$cfg['SendErrorReports'] = 'never';
$cfg['ShowPhpInfo'] = false;
$cfg['AllowUserDropDatabase'] = false;
