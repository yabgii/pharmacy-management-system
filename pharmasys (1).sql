-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 31, 2026 at 03:28 PM
-- Server version: 10.4.28-MariaDB
-- PHP Version: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pharmasys`
--

-- --------------------------------------------------------

--
-- Table structure for table `batches`
--

CREATE TABLE `batches` (
  `id` int(11) NOT NULL,
  `medicine_id` int(11) NOT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `batch_no` varchar(100) NOT NULL,
  `quantity` int(11) NOT NULL,
  `cost_price` decimal(10,2) NOT NULL,
  `selling_price` decimal(10,2) NOT NULL,
  `manufacture_date` date DEFAULT NULL,
  `expiry_date` date NOT NULL,
  `expiry_notified` tinyint(1) DEFAULT 0,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `batches`
--

INSERT INTO `batches` (`id`, `medicine_id`, `supplier_id`, `batch_no`, `quantity`, `cost_price`, `selling_price`, `manufacture_date`, `expiry_date`, `expiry_notified`, `created_by`, `created_at`) VALUES
(1, 3, 1, 'BTATCH 2026-001', 480, 229.99, 399.94, '2026-04-30', '2027-01-27', 0, NULL, '2026-04-29 01:34:27'),
(2, 4, 1, 'BTATCH 2026-003', 80, 229.99, 399.00, '2026-04-07', '2026-05-13', 1, 1, '2026-04-29 02:01:33'),
(3, 5, 1, 'BATCH0023', 389, 340.00, 600.00, '2026-05-06', '2027-10-06', 0, 1, '2026-05-06 09:10:28'),
(4, 5, 1, 'BATCH0024', 40, 300.00, 400.00, '2026-05-09', '2027-10-09', 0, 1, '2026-05-09 01:33:48'),
(5, 3, 1, 'BATCH009', 21, 200.00, 300.00, '2026-05-05', '2027-02-25', 0, 1, '2026-05-09 01:42:23'),
(6, 6, 2, 'Batch 003', 299, 250.00, 300.00, '2026-04-28', '2026-07-13', 1, 1, '2026-05-14 08:20:36');

-- --------------------------------------------------------

--
-- Table structure for table `manufacturers`
--

CREATE TABLE `manufacturers` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `manufacturers`
--

INSERT INTO `manufacturers` (`id`, `name`, `email`, `phone`, `created_at`) VALUES
(1, 'gsk', 'yabesiraalemayehu16@gmail.com', '0900464155', '2026-04-29 01:34:27'),
(2, 'Ethiopharma', 'ethio@gnail.com', '0900464155', '2026-05-14 08:20:36');

-- --------------------------------------------------------

--
-- Table structure for table `medicines`
--

CREATE TABLE `medicines` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `generic_name` varchar(255) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `unit` varchar(50) DEFAULT NULL,
  `manufacturer_id` int(11) DEFAULT NULL,
  `min_stock_level` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `medicines`
--

INSERT INTO `medicines` (`id`, `name`, `generic_name`, `category`, `unit`, `manufacturer_id`, `min_stock_level`, `created_at`) VALUES
(3, 'paracitamol ', 'acetamon', 'antibaiotcs', '500gm', 1, 9, '2026-04-29 01:34:27'),
(4, 'paracitamol ', 'acetamon', 'antibaiotcs', '500gm', 1, 9, '2026-04-29 02:01:33'),
(5, 'desu', 'adejkw', 'pain', '250mg', 2, 9, '2026-05-06 09:10:28'),
(6, 'Viagra', 'Aniltiflamotory', 'Reproductive ', '250g', 2, 9, '2026-05-14 08:20:36');

-- --------------------------------------------------------

--
-- Table structure for table `sales`
--

CREATE TABLE `sales` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `total_profit` decimal(10,2) NOT NULL,
  `payment_method` enum('cash','cbe','telebirr','other') DEFAULT 'cash',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` enum('draft','pending','completed','cancelled') DEFAULT 'draft',
  `completed_by` int(11) DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `sent_to_cashier_at` timestamp NULL DEFAULT NULL,
  `sent_by` int(11) DEFAULT NULL,
  `session_id` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sales`
--

INSERT INTO `sales` (`id`, `user_id`, `total_amount`, `total_profit`, `payment_method`, `created_at`, `status`, `completed_by`, `completed_at`, `sent_to_cashier_at`, `sent_by`, `session_id`) VALUES
(3, 2, 1999.70, 849.75, 'cash', '2026-05-06 08:00:16', 'completed', 2, '2026-05-06 08:00:49', NULL, NULL, NULL),
(4, 2, 399.94, 169.95, 'cash', '2026-05-06 09:08:15', 'completed', 3, '2026-05-06 10:17:00', '2026-05-06 09:08:22', 2, NULL),
(10, 1, 999.94, 429.95, 'cash', '2026-05-06 09:33:08', 'completed', 1, '2026-05-06 09:33:17', NULL, NULL, NULL),
(14, 2, 1800.00, 780.00, 'cash', '2026-05-06 10:09:38', 'completed', 3, '2026-05-06 10:17:07', '2026-05-06 10:09:46', 2, NULL),
(15, 2, 2399.64, 1019.70, 'cash', '2026-05-06 10:09:58', 'completed', 2, '2026-05-06 10:10:01', NULL, NULL, NULL),
(16, 2, 600.00, 260.00, 'cash', '2026-05-09 01:25:07', 'completed', 2, '2026-05-09 01:25:12', NULL, NULL, NULL),
(17, 2, 600.00, 260.00, 'cash', '2026-05-09 01:28:31', 'completed', 2, '2026-05-09 01:28:33', NULL, NULL, NULL),
(18, 2, 399.94, 169.95, 'cash', '2026-05-09 01:29:27', 'completed', 2, '2026-05-09 01:29:28', NULL, NULL, NULL),
(27, 2, 399.94, 169.95, 'cash', '2026-05-09 02:20:02', 'completed', 2, '2026-05-09 02:20:04', NULL, NULL, NULL),
(28, 2, 399.94, 169.95, 'cash', '2026-05-09 02:31:06', 'completed', 2, '2026-05-09 02:31:08', NULL, NULL, NULL),
(29, 2, 300.00, 100.00, 'cash', '2026-05-09 02:33:00', 'completed', 2, '2026-05-09 02:33:02', NULL, NULL, NULL),
(30, 2, 399.94, 169.95, 'cash', '2026-05-09 02:38:46', 'completed', 2, '2026-05-09 02:39:00', NULL, NULL, NULL),
(33, 2, 799.88, 339.90, 'cash', '2026-05-12 04:51:00', 'completed', 3, '2026-05-12 04:51:52', '2026-05-12 04:51:07', 2, NULL),
(34, 2, 600.00, 260.00, 'cash', '2026-05-12 04:54:58', 'completed', 3, '2026-05-12 04:58:48', '2026-05-12 04:55:03', 2, NULL),
(35, 2, 600.00, 260.00, 'cash', '2026-05-12 05:02:22', 'completed', 2, '2026-05-12 05:02:29', NULL, NULL, NULL),
(37, 2, 399.94, 169.95, '', '2026-05-14 13:34:21', 'completed', 2, '2026-05-14 13:48:54', NULL, NULL, NULL),
(38, 2, 600.00, 260.00, 'cbe', '2026-05-14 13:56:04', 'completed', 2, '2026-05-14 13:56:12', NULL, NULL, NULL),
(40, 2, 399.94, 169.95, 'telebirr', '2026-05-14 14:20:02', 'completed', 2, '2026-05-14 14:20:05', NULL, NULL, NULL),
(41, 2, 300.00, 50.00, 'cbe', '2026-05-14 14:35:56', 'completed', 2, '2026-05-14 14:35:59', NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `sale_items`
--

CREATE TABLE `sale_items` (
  `id` int(11) NOT NULL,
  `sale_id` int(11) NOT NULL,
  `batch_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `selling_price` decimal(10,2) NOT NULL,
  `cost_price` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `profit` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sale_items`
--

INSERT INTO `sale_items` (`id`, `sale_id`, `batch_id`, `quantity`, `selling_price`, `cost_price`, `subtotal`, `profit`) VALUES
(1, 3, 1, 5, 399.94, 229.99, 1999.70, 849.75),
(5, 4, 1, 1, 399.94, 229.99, 399.94, 169.95),
(14, 10, 3, 1, 600.00, 340.00, 600.00, 260.00),
(15, 10, 1, 1, 399.94, 229.99, 399.94, 169.95),
(22, 14, 3, 3, 600.00, 340.00, 1800.00, 780.00),
(23, 15, 1, 6, 399.94, 229.99, 2399.64, 1019.70),
(24, 16, 3, 1, 600.00, 340.00, 600.00, 260.00),
(25, 17, 3, 1, 600.00, 340.00, 600.00, 260.00),
(26, 18, 1, 1, 399.94, 229.99, 399.94, 169.95),
(30, 27, 2, 1, 399.94, 229.99, 399.94, 169.95),
(31, 28, 1, 1, 399.94, 229.99, 399.94, 169.95),
(32, 29, 5, 1, 300.00, 200.00, 300.00, 100.00),
(33, 30, 1, 1, 399.94, 229.99, 399.94, 169.95),
(36, 33, 1, 2, 399.94, 229.99, 799.88, 339.90),
(37, 34, 3, 1, 600.00, 340.00, 600.00, 260.00),
(38, 35, 3, 1, 600.00, 340.00, 600.00, 260.00),
(39, 37, 1, 1, 399.94, 229.99, 399.94, 169.95),
(40, 38, 3, 1, 600.00, 340.00, 600.00, 260.00),
(42, 40, 1, 1, 399.94, 229.99, 399.94, 169.95),
(43, 41, 6, 1, 300.00, 250.00, 300.00, 50.00);

-- --------------------------------------------------------

--
-- Table structure for table `stock_movements`
--

CREATE TABLE `stock_movements` (
  `id` int(11) NOT NULL,
  `batch_id` int(11) NOT NULL,
  `type` enum('IN','OUT') NOT NULL,
  `quantity` int(11) NOT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `suppliers`
--

CREATE TABLE `suppliers` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `suppliers`
--

INSERT INTO `suppliers` (`id`, `name`, `email`, `phone`, `address`, `created_at`) VALUES
(1, 'jjj', 'yabesiraalemayehu16@gmail.com', '0900464156', 'Addis Ababa', '2026-04-29 02:01:33'),
(2, 'Supiu', 'sup@gnail.com', '0900464155', 'Addis Abeba\r\n ', '2026-05-14 08:20:36'),
(3, 'meron alemayehu', 'meronalemayehu82@gmail.com', '+251900464155', 'Addis Abeba', '2026-05-14 11:16:57');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `username` varchar(100) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('owner','pharmacist','cashier') DEFAULT 'pharmacist',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `username`, `email`, `password`, `role`, `status`, `created_at`) VALUES
(1, 'yeabesira alemayehu', 'med1', 'yabesiraalemayehu16@gmail.com', '$2b$10$mIsRVASQ9bykKg/29/4NseLQ8cS4XlgYPnOnZYic3V80ZAabn3asK', 'owner', 'active', '2026-04-27 09:49:58'),
(2, 'samuale getu  ', 'sami', 'sami@gmail.com', '$2b$10$CV4O9igZ0g4qUZem2lTg.OSGUaJJCAs5WbvVwrZugusE4bIbDSLLW', 'pharmacist', 'active', '2026-04-30 13:28:38'),
(3, 'meron alemayehu', 'meri', 'meronalemayehu82@gmail.com', '$2b$10$cwpeMkTFtu7tn1ktU9.RjORgNgHrUsUEWmAc0r9lEMV/Hh2S4a6zO', 'cashier', 'active', '2026-05-06 10:16:24');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `batches`
--
ALTER TABLE `batches`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `medicine_id` (`medicine_id`,`batch_no`),
  ADD KEY `supplier_id` (`supplier_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_batches_medicine` (`medicine_id`),
  ADD KEY `idx_batches_expiry` (`expiry_date`);

--
-- Indexes for table `manufacturers`
--
ALTER TABLE `manufacturers`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `medicines`
--
ALTER TABLE `medicines`
  ADD PRIMARY KEY (`id`),
  ADD KEY `manufacturer_id` (`manufacturer_id`);

--
-- Indexes for table `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_sales_date` (`created_at`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_pending` (`status`,`created_at`),
  ADD KEY `completed_by` (`completed_by`),
  ADD KEY `sent_by` (`sent_by`),
  ADD KEY `idx_payment_method` (`payment_method`);

--
-- Indexes for table `sale_items`
--
ALTER TABLE `sale_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `batch_id` (`batch_id`),
  ADD KEY `idx_sale_items_sale` (`sale_id`);

--
-- Indexes for table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `batch_id` (`batch_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `suppliers`
--
ALTER TABLE `suppliers`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `batches`
--
ALTER TABLE `batches`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `manufacturers`
--
ALTER TABLE `manufacturers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `medicines`
--
ALTER TABLE `medicines`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `sales`
--
ALTER TABLE `sales`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=42;

--
-- AUTO_INCREMENT for table `sale_items`
--
ALTER TABLE `sale_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=44;

--
-- AUTO_INCREMENT for table `stock_movements`
--
ALTER TABLE `stock_movements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `suppliers`
--
ALTER TABLE `suppliers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `batches`
--
ALTER TABLE `batches`
  ADD CONSTRAINT `batches_ibfk_1` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`),
  ADD CONSTRAINT `batches_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  ADD CONSTRAINT `batches_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `medicines`
--
ALTER TABLE `medicines`
  ADD CONSTRAINT `medicines_ibfk_1` FOREIGN KEY (`manufacturer_id`) REFERENCES `manufacturers` (`id`);

--
-- Constraints for table `sales`
--
ALTER TABLE `sales`
  ADD CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `sales_ibfk_2` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `sales_ibfk_3` FOREIGN KEY (`sent_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `sale_items`
--
ALTER TABLE `sale_items`
  ADD CONSTRAINT `sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sale_items_ibfk_2` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`id`);

--
-- Constraints for table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD CONSTRAINT `stock_movements_ibfk_1` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`id`),
  ADD CONSTRAINT `stock_movements_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
