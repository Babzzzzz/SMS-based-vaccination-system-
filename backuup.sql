--
-- Host: localhost    Database: vacc_system
-- ------------------------------------------------------
-- Server version	9.7.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

-- GTID state at the beginning of the backup 

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '95647fde-6a31-11f1-91ed-5aa83e3f7eba:1-126';

-- Current Database: `vacc_system`
--

CREATE DATABASE `vacc_system`;

USE `vacc_system`;
-- Table structure for table `appointment`

DROP TABLE IF EXISTS `appointment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointment` (
  `apptID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `childID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `facilityID` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `apptDate` datetime NOT NULL,
  `vaccineType` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('scheduled','done','missed') COLLATE utf8mb4_unicode_ci DEFAULT 'scheduled',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`apptID`),
  KEY `idx_appt_date` (`apptDate`),
  KEY `idx_appt_status` (`status`),
  KEY `idx_appt_child` (`childID`),
  CONSTRAINT `appointment_ibfk_1` FOREIGN KEY (`childID`) REFERENCES `child` (`childID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

-- Dumping data for table `appointment`
LOCK TABLES `appointment` WRITE;
/*!40000 ALTER TABLE `appointment` DISABLE KEYS */;
INSERT INTO `appointment` VALUES ('11faf8b4-6ae8-11f1-b533-a5cc11ed7582','ch-001','Kenyatta National Hospital','2026-06-19 19:33:59','Penta 1 + OPV 1 + PCV 1','scheduled','2026-06-18 07:33:59'),('7099acac-6a71-11f1-b533-a5cc11ed7582','7098e6c8-6a71-11f1-b533-a5cc11ed7582','Kizungu Mkuti Hospital','2026-06-17 00:00:00','BCG + OPV 0','missed','2026-06-17 17:24:47'),('7099f586-6a71-11f1-b533-a5cc11ed7582','7098e6c8-6a71-11f1-b533-a5cc11ed7582','Kizungu Mkuti Hospital','2026-07-29 00:00:00','Penta 1 + OPV 1 + PCV 1','scheduled','2026-06-17 17:24:47'),('709a6192-6a71-11f1-b533-a5cc11ed7582','7098e6c8-6a71-11f1-b533-a5cc11ed7582','Kizungu Mkuti Hospital','2026-08-26 00:00:00','Penta 2 + OPV 2 + PCV 2','scheduled','2026-06-17 17:24:47'),('709abbf6-6a71-11f1-b533-a5cc11ed7582','7098e6c8-6a71-11f1-b533-a5cc11ed7582','Kizungu Mkuti Hospital','2026-09-23 00:00:00','Penta 3 + OPV 3 + PCV 3','scheduled','2026-06-17 17:24:47'),('709b2532-6a71-11f1-b533-a5cc11ed7582','7098e6c8-6a71-11f1-b533-a5cc11ed7582','Kizungu Mkuti Hospital','2027-03-17 00:00:00','Measles 1 + Yellow fever','scheduled','2026-06-17 17:24:47'),('709c12d0-6a71-11f1-b533-a5cc11ed7582','7098e6c8-6a71-11f1-b533-a5cc11ed7582','Kizungu Mkuti Hospital','2027-12-15 00:00:00','Measles 2 + Rubella','scheduled','2026-06-17 17:24:47');
/*!40000 ALTER TABLE `appointment` ENABLE KEYS */;
UNLOCK TABLES;

-- Table structure for table `audit_log`
DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `logID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `ipAddress` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`logID`),
  KEY `idx_audit_user` (`userID`),
  KEY `idx_audit_ts` (`timestamp`),
  CONSTRAINT `audit_log_ibfk_1` FOREIGN KEY (`userID`) REFERENCES `user` (`userID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- Dumping data for table `audit_log`
LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
INSERT INTO `audit_log` VALUES ('063a5d90-6a6a-11f1-b533-a5cc11ed7582','user-prov-001','Viewed SMS delivery log for facility Kenyatta National Hospital','2026-06-17 19:31:42',NULL),('063aab2e-6a6a-11f1-b533-a5cc11ed7582','user-prov-001','Generated defaulter report for facility Kenyatta National Hospital','2026-06-17 19:31:42',NULL),('063b4034-6a6a-11f1-b533-a5cc11ed7582','user-prov-001','Generated coverage report for facility Kenyatta National Hospital','2026-06-17 19:31:42',NULL),('06ff44de-6a6a-11f1-b533-a5cc11ed7582','user-prov-001','Viewed SMS delivery log for facility Kenyatta National Hospital','2026-06-17 19:31:44',NULL),('1cc3c664-6a7e-11f1-b533-a5cc11ed7582','bb8fa9f6-6a70-11f1-b533-a5cc11ed7582','User logged in','2026-06-17 21:55:30','::1'),('54bca072-6a6a-11f1-b533-a5cc11ed7582','user-prov-001','User logged in','2026-06-17 19:33:54','::1'),('5e2bd8bc-6a6a-11f1-b533-a5cc11ed7582','user-prov-001','Viewed SMS delivery log for facility Kenyatta National Hospital','2026-06-17 19:34:10',NULL),('5e2cbcbe-6a6a-11f1-b533-a5cc11ed7582','user-prov-001','Generated defaulter report for facility Kenyatta National Hospital','2026-06-17 19:34:10',NULL),('5e2d012e-6a6a-11f1-b533-a5cc11ed7582','user-prov-001','Generated coverage report for facility Kenyatta National Hospital','2026-06-17 19:34:10',NULL),('5eef8366-6a6a-11f1-b533-a5cc11ed7582','user-prov-001','Viewed SMS delivery log for facility Kenyatta National Hospital','2026-06-17 19:34:11',NULL),('619928dc-6ae8-11f1-b533-a5cc11ed7582','user-admin-001','User logged in','2026-06-18 10:36:12','::1'),('6dbd9c98-6a6a-11f1-b533-a5cc11ed7582','user-admin-001','User logged in','2026-06-17 19:34:36','::1'),('70983430-6a71-11f1-b533-a5cc11ed7582','bb8fa9f6-6a70-11f1-b533-a5cc11ed7582','Registered caregiver: Yuri Renyei (70979b92-6a71-11f1-b533-a5cc11ed7582)','2026-06-17 20:24:47','::1'),('709c4fe8-6a71-11f1-b533-a5cc11ed7582','bb8fa9f6-6a70-11f1-b533-a5cc11ed7582','Generated KEPI schedule for child 7098e6c8-6a71-11f1-b533-a5cc11ed7582 — 6 appointments','2026-06-17 20:24:47','::1'),('709c8652-6a71-11f1-b533-a5cc11ed7582','bb8fa9f6-6a70-11f1-b533-a5cc11ed7582','Registered child: Isaak Marquies (7098e6c8-6a71-11f1-b533-a5cc11ed7582)','2026-06-17 20:24:47','::1'),('778100ca-6a6b-11f1-b533-a5cc11ed7582','user-prov-001','User logged in','2026-06-17 19:42:02','::1'),('797cbe10-6a6a-11f1-b533-a5cc11ed7582','user-admin-001','Generated coverage report for facility Ministry of Health','2026-06-17 19:34:56',NULL),('797cc4f0-6a6a-11f1-b533-a5cc11ed7582','user-admin-001','Generated defaulter report for facility Ministry of Health','2026-06-17 19:34:56',NULL),('797ccbd0-6a6a-11f1-b533-a5cc11ed7582','user-admin-001','Viewed SMS delivery log for facility Ministry of Health','2026-06-17 19:34:56',NULL),('7a18f3b0-6a6b-11f1-b533-a5cc11ed7582','user-prov-001','Viewed SMS delivery log for facility Kenyatta National Hospital','2026-06-17 19:42:06',NULL),('7b3361b8-6a70-11f1-b533-a5cc11ed7582','user-admin-001','User logged in','2026-06-17 20:17:56','::1'),('7c2eeb82-6a6b-11f1-b533-a5cc11ed7582','user-prov-001','Viewed SMS delivery log for facility Kenyatta National Hospital','2026-06-17 19:42:10',NULL),('7c2f04dc-6a6b-11f1-b533-a5cc11ed7582','user-prov-001','Generated defaulter report for facility Kenyatta National Hospital','2026-06-17 19:42:10',NULL),('7c3001f2-6a6b-11f1-b533-a5cc11ed7582','user-prov-001','Generated coverage report for facility Kenyatta National Hospital','2026-06-17 19:42:10',NULL),('8c534d28-6a66-11f1-b533-a5cc11ed7582','user-prov-001','User logged in','2026-06-17 19:06:49','::1'),('9d01eca2-6a6a-11f1-b533-a5cc11ed7582','user-prov-001','User logged in','2026-06-17 19:35:55','::1'),('a04fb6d2-6a65-11f1-b533-a5cc11ed7582','user-prov-001','User logged in','2026-06-17 19:00:13','::1'),('a05e5e76-6a65-11f1-b533-a5cc11ed7582','user-admin-001','User logged in','2026-06-17 19:00:13','::1'),('adf27974-6a69-11f1-b533-a5cc11ed7582','user-admin-001','User logged in','2026-06-17 19:29:14','::1'),('bb915f4e-6a70-11f1-b533-a5cc11ed7582','user-admin-001','Created user: nurse.mary (role: provider)','2026-06-17 20:19:44','::1'),('cc3d8eea-6a65-11f1-b533-a5cc11ed7582','user-prov-001','User logged in','2026-06-17 19:01:27','::1'),('cc51b8a2-6a65-11f1-b533-a5cc11ed7582','user-admin-001','User logged in','2026-06-17 19:01:27','::1'),('f7c569c6-6a69-11f1-b533-a5cc11ed7582','user-prov-001','User logged in','2026-06-17 19:31:18','::1'),('f8ac03a2-6a70-11f1-b533-a5cc11ed7582','bb8fa9f6-6a70-11f1-b533-a5cc11ed7582','User logged in','2026-06-17 20:21:26','::1');
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `caregiver`
--

DROP TABLE IF EXISTS `caregiver`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `caregiver` (
  `caregiverID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `language` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'sw',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`caregiverID`),
  UNIQUE KEY `phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
-- Dumping data for table `caregiver'

LOCK TABLES `caregiver` WRITE;
/*!40000 ALTER TABLE `caregiver` DISABLE KEYS */;
INSERT INTO `caregiver` VALUES ('70979b92-6a71-11f1-b533-a5cc11ed7582','Yuri Renyei','+254732 869 670','sw','2026-06-17 17:24:47'),('cg-001','Ester Wanjiru','+254712345678','sw','2026-06-17 15:57:03');
/*!40000 ALTER TABLE `caregiver` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `child`
--

DROP TABLE IF EXISTS `child`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `child` (
  `childID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `caregiverID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dob` date NOT NULL,
  `gender` enum('M','F','O') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `birthWeight` decimal(4,2) DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`childID`),
  UNIQUE KEY `uk_child` (`caregiverID`,`name`,`dob`),
  KEY `idx_child_cg` (`caregiverID`),
  CONSTRAINT `child_ibfk_1` FOREIGN KEY (`caregiverID`) REFERENCES `caregiver` (`caregiverID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

-- Dumping data for table `child`
LOCK TABLES `child` WRITE;
/*!40000 ALTER TABLE `child` DISABLE KEYS */;
INSERT INTO `child` VALUES ('7098e6c8-6a71-11f1-b533-a5cc11ed7582','70979b92-6a71-11f1-b533-a5cc11ed7582','Isaak Marquies','2026-06-17','M',3.15,'2026-06-17 17:24:47'),('ch-001','cg-001','Brian Kamau','2025-11-15','M',3.20,'2026-06-17 15:57:03');
/*!40000 ALTER TABLE `child` ENABLE KEYS */;
UNLOCK TABLES;


-- Table structure for table `report`
DROP TABLE IF EXISTS `report`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report` (
  `reportID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `generatedByID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `generatedDate` date DEFAULT (curdate()),
  `data` json DEFAULT NULL,
  PRIMARY KEY (`reportID`),
  KEY `generatedByID` (`generatedByID`),
  CONSTRAINT `report_ibfk_1` FOREIGN KEY (`generatedByID`) REFERENCES `user` (`userID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

-- Dumping data for table `report`
LOCK TABLES `report` WRITE;
/*!40000 ALTER TABLE `report` DISABLE KEYS */;
INSERT INTO `report` VALUES ('063aca6e-6a6a-11f1-b533-a5cc11ed7582','user-prov-001','coverage','2026-06-17','{\"summary\": {\"coveragePct\": null, \"totalDefaulters\": 0, \"totalRegistered\": 0, \"totalVaccinated\": 0}, \"byVaccine\": []}'),('5e2cb2f0-6a6a-11f1-b533-a5cc11ed7582','user-prov-001','coverage','2026-06-17','{\"summary\": {\"coveragePct\": null, \"totalDefaulters\": 0, \"totalRegistered\": 0, \"totalVaccinated\": 0}, \"byVaccine\": []}'),('797c93ea-6a6a-11f1-b533-a5cc11ed7582','user-admin-001','coverage','2026-06-17','{\"summary\": {\"coveragePct\": null, \"totalDefaulters\": 0, \"totalRegistered\": 0, \"totalVaccinated\": 0}, \"byVaccine\": []}'),('7c2f97e4-6a6b-11f1-b533-a5cc11ed7582','user-prov-001','coverage','2026-06-17','{\"summary\": {\"coveragePct\": null, \"totalDefaulters\": 0, \"totalRegistered\": 0, \"totalVaccinated\": 0}, \"byVaccine\": []}');
/*!40000 ALTER TABLE `report` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sms_log`
--

DROP TABLE IF EXISTS `sms_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sms_log` (
  `logID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `apptID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `deliveryStatus` enum('sent','delivered','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'sent',
  `direction` enum('in','out') COLLATE utf8mb4_unicode_ci NOT NULL,
  `retryCount` tinyint DEFAULT '0',
  PRIMARY KEY (`logID`),
  KEY `idx_sms_appt` (`apptID`),
  KEY `idx_sms_dir` (`direction`),
  CONSTRAINT `sms_log_ibfk_1` FOREIGN KEY (`apptID`) REFERENCES `appointment` (`apptID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sms_log`
--

LOCK TABLES `sms_log` WRITE;
/*!40000 ALTER TABLE `sms_log` DISABLE KEYS */;
INSERT INTO `sms_log` VALUES ('12003b08-6ae8-11f1-b533-a5cc11ed7582','11faf8b4-6ae8-11f1-b533-a5cc11ed7582','Karibu Ester Wanjiru. Kumbusho: Brian Kamau ana chanjo ya Penta 1 + OPV 1 + PCV 1 tarehe 19 Jun 2026, the clinic. Jibu YES kuthibitisha, NO, au RESCHEDULE. - VaccKE','2026-06-18 10:33:59','delivered','out',0),('810bcafc-6a8f-11f1-b533-a5cc11ed7582','7099acac-6a71-11f1-b533-a5cc11ed7582','Habari Yuri Renyei. Tunaona Isaak Marquies hakufika kwa chanjo ya BCG + OPV 0. Tafadhali wasiliana nasi. - VaccKE','2026-06-18 00:00:00','delivered','out',0),('8c302816-6a7f-11f1-b533-a5cc11ed7582','7099acac-6a71-11f1-b533-a5cc11ed7582','vaccSystem: end-to-end test through the application','2026-06-17 22:05:47','delivered','out',0);
/*!40000 ALTER TABLE `sms_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sms_template`
--

DROP TABLE IF EXISTS `sms_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sms_template` (
  `templateID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `language` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `templateType` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`templateID`),
  UNIQUE KEY `uk_template` (`language`,`templateType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- Dumping data for table `sms_template`
LOCK TABLES `sms_template` WRITE;
/*!40000 ALTER TABLE `sms_template` DISABLE KEYS */;
INSERT INTO `sms_template` VALUES ('tpl-en-24hr','en','24hr','Final reminder: {child} has a vaccination appointment tomorrow {date}. Reply YES, NO or RESCHEDULE. - VaccKE','2026-06-17 15:57:03'),('tpl-en-48hr','en','48hr','Dear {name}, reminder: {child} has a {vaccine} appointment on {date} at {facility}. Reply YES, NO or RESCHEDULE. - VaccKE','2026-06-17 15:57:03'),('tpl-en-confirm','en','confirm','Thank you {name}. We have confirmed {child}\'s {vaccine} appointment on {date}. - VaccKE','2026-06-17 15:57:03'),('tpl-en-followup','en','followup','Dear {name}, {child} missed the {vaccine} appointment. Please contact us to reschedule. - VaccKE','2026-06-17 15:57:03'),('tpl-sw-24hr','sw','24hr','Kumbusho la mwisho: {child} ana chanjo kesho tarehe {date}. Jibu YES, NO, au RESCHEDULE. - VaccKE','2026-06-17 15:57:03'),('tpl-sw-48hr','sw','48hr','Karibu {name}. Kumbusho: {child} ana chanjo ya {vaccine} tarehe {date}, {facility}. Jibu YES kuthibitisha, NO, au RESCHEDULE. - VaccKE','2026-06-17 15:57:03'),('tpl-sw-confirm','sw','confirm','Asante {name}. Tumethibitisha miadi ya {child} kwa {vaccine} tarehe {date}. - VaccKE','2026-06-17 15:57:03'),('tpl-sw-followup','sw','followup','Habari {name}. Tunaona {child} hakufika kwa chanjo ya {vaccine}. Tafadhali wasiliana nasi. - VaccKE','2026-06-17 15:57:03');
/*!40000 ALTER TABLE `sms_template` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_setting`
--

DROP TABLE IF EXISTS `system_setting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_setting` (
  `settingKey` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `settingValue` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`settingKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_setting`
--

LOCK TABLES `system_setting` WRITE;
/*!40000 ALTER TABLE `system_setting` DISABLE KEYS */;
INSERT INTO `system_setting` VALUES ('at_provider','Africa\'s Talking','2026-06-17 15:57:03'),('gateway_status','online','2026-06-17 15:57:03'),('reminder_hours_first','48','2026-06-17 15:57:03'),('reminder_hours_second','24','2026-06-17 15:57:03'),('sender_id','','2026-06-17 19:04:50'),('sms_max_retries','3','2026-06-17 15:57:03');
/*!40000 ALTER TABLE `system_setting` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `userID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `roleID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `passwordHash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isActive` tinyint(1) DEFAULT '1',
  `roleType` enum('admin','provider','caregiver') COLLATE utf8mb4_unicode_ci NOT NULL,
  `facility` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastLogin` datetime DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`userID`),
  UNIQUE KEY `username` (`username`),
  KEY `roleID` (`roleID`),
  CONSTRAINT `user_ibfk_1` FOREIGN KEY (`roleID`) REFERENCES `user_role` (`roleID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- Dumping data for table `user`
LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES ('bb8fa9f6-6a70-11f1-b533-a5cc11ed7582','role-provider','nurse.mary','$2a$10$4itGc3UwU1stg.7caPcnHO3dTDvJw/3trPFpUDpBspkR/EyVOpoTW',1,'provider','Kizungu Mkuti Hospital','Mary.anyango@gmail.com','2026-06-17 21:55:30','2026-06-17 17:19:44'),('user-admin-001','role-admin','sysadmin','$2b$10$Wd2wnk/ZbU3hjca.LcZIi.yCEFFaQPneCHiF4wyOirebwuDr3mLAW',1,'admin','Ministry of Health','admin@vaccsystem.go.ke','2026-06-18 10:36:12','2026-06-17 15:57:03'),('user-prov-001','role-provider','dr.kamau','$2b$10$q4CnKmGR/DKAFlD/3ifm1.NNuZy2/FP4C8sQdkEXI/WSqicfg87Am',1,'provider','Kenyatta National Hospital','dr.kamau@knh.go.ke','2026-06-17 19:42:02','2026-06-17 15:57:03');
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;


-- Table structure for table `user_role`
DROP TABLE IF EXISTS `user_role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_role` (
  `roleID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `roleName` enum('admin','provider','caregiver') COLLATE utf8mb4_unicode_ci NOT NULL,
  `permissions` json DEFAULT NULL,
  PRIMARY KEY (`roleID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_role`
--

LOCK TABLES `user_role` WRITE;
/*!40000 ALTER TABLE `user_role` DISABLE KEYS */;
INSERT INTO `user_role` VALUES ('role-admin','admin','{\"canManageUsers\": true, \"canViewAuditLog\": true, \"canConfigureGateway\": true}'),('role-cg','caregiver','{\"smsOnly\": true}'),('role-provider','provider','{\"canViewReports\": true, \"canRegisterPatients\": true, \"canRecordVaccinations\": true}');
/*!40000 ALTER TABLE `user_role` ENABLE KEYS */;
UNLOCK TABLES;


-- Table structure for table `vaccination_record`
DROP TABLE IF EXISTS `vaccination_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vaccination_record` (
  `recordID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `apptID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `providerID` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vaccineType` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `doseNumber` tinyint NOT NULL,
  `dateAdministered` date NOT NULL,
  `batchNumber` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `administeringProvider` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`recordID`),
  UNIQUE KEY `apptID` (`apptID`),
  KEY `providerID` (`providerID`),
  CONSTRAINT `vaccination_record_ibfk_1` FOREIGN KEY (`apptID`) REFERENCES `appointment` (`apptID`),
  CONSTRAINT `vaccination_record_ibfk_2` FOREIGN KEY (`providerID`) REFERENCES `user` (`userID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- Dumping data for table `vaccination_record`
LOCK TABLES `vaccination_record` WRITE;
/*!40000 ALTER TABLE `vaccination_record` DISABLE KEYS */;
/*!40000 ALTER TABLE `vaccination_record` ENABLE KEYS */;
UNLOCK TABLES;

-- Dumping routines for database 'vacc_system'
--
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

